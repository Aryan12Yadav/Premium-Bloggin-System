package exchange

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
)

type DeltaRestClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewDeltaRestClient(baseURL string) *DeltaRestClient {
	return &DeltaRestClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type deltaProductResponse struct {
	Success bool `json:"success"`
	Result  struct {
		ID                   int64   `json:"id"`
		Symbol               string  `json:"symbol"`
		ContractType         string  `json:"contract_type"`
		ContractValue        string  `json:"contract_value"`
		TickSize             string  `json:"tick_size"`
		ContractUnitCurrency string  `json:"contract_unit_currency"`
		State                string  `json:"state"`
		QuotingAsset         struct {
			Symbol    string `json:"symbol"`
			Precision int    `json:"precision"`
		} `json:"quoting_asset"`
		SettlingAsset struct {
			Symbol    string `json:"symbol"`
			Precision int    `json:"precision"`
		} `json:"settling_asset"`
	} `json:"result"`
}

type deltaChartResponse struct {
	Success bool `json:"success"`
	Result  struct {
		T []int64   `json:"t"`
		O []float64 `json:"o"`
		H []float64 `json:"h"`
		L []float64 `json:"l"`
		C []float64 `json:"c"`
		V []float64 `json:"v"`
	} `json:"result"`
}

// FetchProductMetadata fetches contract specifications from Delta REST API
func (c *DeltaRestClient) FetchProductMetadata(symbol string) (*models.InstrumentMetadata, error) {
	// If product_id 27 or BTCUSD is requested, check both 27 and BTCUSD / BTCUSDT
	lookupSymbol := symbol
	if symbol == "27" {
		lookupSymbol = "BTCUSD"
	}

	url := fmt.Sprintf("%s/v2/products/%s", c.baseURL, lookupSymbol)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create delta product request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (DeltaEngine/1.0)")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call delta product endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("delta product endpoint returned status %d: %s", resp.StatusCode, string(body))
	}

	var productResp deltaProductResponse
	if err := json.NewDecoder(resp.Body).Decode(&productResp); err != nil {
		return nil, fmt.Errorf("failed to decode product response: %w", err)
	}

	if !productResp.Success {
		return nil, fmt.Errorf("delta product response marked unsuccessful")
	}

	res := productResp.Result
	contractValue, _ := strconv.ParseFloat(res.ContractValue, 64)
	if contractValue <= 0 {
		contractValue = 1.0 // BTCUSD inverse is typically 1 USD, BTCUSDT is 0.001 BTC
	}

	tickSize, _ := strconv.ParseFloat(res.TickSize, 64)
	if tickSize <= 0 {
		tickSize = 0.5
	}

	meta := &models.InstrumentMetadata{
		Symbol:            res.Symbol,
		ProductID:         res.ID,
		ContractType:      res.ContractType,
		ContractValue:     contractValue,
		TickSize:          tickSize,
		ContractUnit:      res.ContractUnitCurrency,
		QuotingAsset:      res.QuotingAsset.Symbol,
		SettlingAsset:     res.SettlingAsset.Symbol,
		PricePrecision:    res.QuotingAsset.Precision,
		QuantityPrecision: 3,
		State:             res.State,
	}

	return meta, nil
}

// FetchHistoricalCandles fetches the last N historical candles from Delta Exchange
func (c *DeltaRestClient) FetchHistoricalCandles(symbol, resolution string, count int) ([]models.Candle, error) {
	if count <= 0 {
		count = 120
	}
	if resolution == "" {
		resolution = "1"
	}

	// Resolution duration in minutes
	resMinutes := 1
	if r, err := strconv.Atoi(resolution); err == nil && r > 0 {
		resMinutes = r
	}

	now := time.Now().Unix()
	from := now - int64(count*resMinutes*60)

	// In Delta Exchange, symbol BTCUSDT has live trading candles.
	// Map BTCUSD and 27 to active perpetual BTCUSDT candles tagged with requested symbol.
	lookupSym := symbol
	if lookupSym == "BTCUSD" || lookupSym == "27" {
		lookupSym = "BTCUSDT"
	}

	candles, err := c.queryChartHistory(lookupSym, resolution, from, now, resMinutes)
	if err == nil && len(candles) > 0 {
		for i := range candles {
			candles[i].Symbol = symbol
		}
		return candles, nil
	}

	if lookupSym != "BTCUSDT" {
		fallbackCandles, fallbackErr := c.queryChartHistory("BTCUSDT", resolution, from, now, resMinutes)
		if fallbackErr == nil && len(fallbackCandles) > 0 {
			for i := range fallbackCandles {
				fallbackCandles[i].Symbol = symbol
			}
			return fallbackCandles, nil
		}
	}

	return nil, err
}

func (c *DeltaRestClient) queryChartHistory(sym, res string, from, to int64, resMinutes int) ([]models.Candle, error) {
	url := fmt.Sprintf("%s/v2/chart/history?symbol=%s&resolution=%s&from=%d&to=%d", c.baseURL, sym, res, from, to)
	
	var chartResp deltaChartResponse
	var lastErr error

	for attempt := 1; attempt <= 3; attempt++ {
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "curl/8.14.1")
		req.Header.Set("Accept", "*/*")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(attempt*400) * time.Millisecond)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("chart history returned status %d for %s: %s", resp.StatusCode, url, string(bodyBytes))
			time.Sleep(time.Duration(attempt*500) * time.Millisecond)
			continue
		}

		err = json.NewDecoder(resp.Body).Decode(&chartResp)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(attempt*400) * time.Millisecond)
			continue
		}

		if !chartResp.Success || len(chartResp.Result.T) == 0 {
			return nil, fmt.Errorf("empty chart history returned")
		}

		lastErr = nil
		break
	}

	if lastErr != nil {
		return nil, lastErr
	}

	r := chartResp.Result
	candles := make([]models.Candle, 0, len(r.T))
	dur := time.Duration(resMinutes) * time.Minute

	for i := 0; i < len(r.T); i++ {
		t := time.Unix(r.T[i], 0).UTC()
		candles = append(candles, models.Candle{
			Symbol:    sym,
			Interval:  fmt.Sprintf("%dm", resMinutes),
			StartTime: t,
			EndTime:   t.Add(dur),
			Open:      r.O[i],
			High:      r.H[i],
			Low:       r.L[i],
			Close:     r.C[i],
			Volume:    r.V[i],
			IsClosed:  true,
		})
	}

	return candles, nil
}

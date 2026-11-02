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

// FetchProductMetadata fetches contract specifications from Delta REST API
func (c *DeltaRestClient) FetchProductMetadata(symbol string) (*models.InstrumentMetadata, error) {
	url := fmt.Sprintf("%s/v2/products/%s", c.baseURL, symbol)
	resp, err := c.httpClient.Get(url)
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
		contractValue = 0.001 // Safe default for BTCUSDT perpetual if string parsing fails
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

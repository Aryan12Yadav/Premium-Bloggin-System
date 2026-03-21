# from django.http import HttpResponse

# def home(request):
#     return HttpResponse('<h1> Welcome to Home Page </h1>')


from django.shortcuts import render,redirect
from blogs.models import Category,Blog
from assignments.models import About
from .forms import RegistrationForm
from django.contrib.auth.forms import AuthenticationForm
from django.contrib import auth



def home(request):
    # categories = Category.objects.all()
    featured_posts = Blog.objects.filter(is_featured = True).order_by('updated_at')
    # print(featured_posts)
    posts = Blog.objects.filter(is_featured = False,status = 'Published')
    print(posts)

    # Fetch about us
    try:
        about = About.objects.get()

    except:
        about = None


    context = {
        # 'categories':categories,
        'featured_posts' : featured_posts,
        'posts':posts,
        'about':about,
    }
    return render(request,'home.html',context)
    


def register(request):
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('register')
        else:
            print(form.errors)
    else:
        form = RegistrationForm()
    context = {
        'form':form,
    }
    return render(request,'register.html',context)
 
def login(request):
    if request.method == 'POST':
        form = AuthenticationForm(request,request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']  
            password = form.cleaned_data['password']

            user = auth.authenticate(username = username, password = password)
            if user is not None:
                auth.login(request,user)
                return redirect('dashboard')

    form = AuthenticationForm()
    context = {
        'form':form,
    }
    return render(request,'login.html',context)

    
def logout(request):
    auth.logout(request)
    return redirect('home')
    
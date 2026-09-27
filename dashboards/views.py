from django.shortcuts import render, redirect, get_object_or_404
from blogs.models import Blog, Category
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from .form import CategoryForm, BlogPostForm, AddUserForm, EditUserForm
from django.template.defaultfilters import slugify
from django.contrib.auth.models import User

# Create your views here.
@login_required(login_url='login')
def dashboard(request):
    if request.user.is_staff:
        category_count = Category.objects.all().count()
        blogs_count = Blog.objects.all().count()
    else:
        category_count = Category.objects.filter(author=request.user).count()
        blogs_count = Blog.objects.filter(author=request.user).count()

    context = {
        'category_count': category_count,
        'blogs_count': blogs_count
    }
    return render(request, 'dashboard/dashboard.html', context)

@login_required(login_url='login')
def categories(request):
    if request.user.is_staff:
        categories_list = Category.objects.all()
    else:
        categories_list = Category.objects.filter(author=request.user)
    
    context = {
        'categories': categories_list,
    }
    return render(request, 'dashboard/categories.html', context)

@login_required(login_url='login')
def add_category(request):
    if request.method == 'POST':
        form = CategoryForm(request.POST)
        if form.is_valid():
            category = form.save(commit=False)
            category.author = request.user
            category.save()
            return redirect('categories')

    form = CategoryForm()
    context = {
        'form': form,
    }
    return render(request, 'dashboard/add_category.html', context)

@login_required(login_url='login')
def edit_category(request, pk):
    category = get_object_or_404(Category, pk=pk)
    if not request.user.is_staff and category.author != request.user:
        raise PermissionDenied

    if request.method == 'POST':
        form = CategoryForm(request.POST, instance=category)
        if form.is_valid():
            form.save()
            return redirect('categories')

    form = CategoryForm(instance=category)
    context = {
        'form': form,
        'category': category,
    }
    return render(request, 'dashboard/edit_category.html', context)

@login_required(login_url='login')
def delete_category(request, pk):
    category = get_object_or_404(Category, pk=pk)
    if not request.user.is_staff and category.author != request.user:
        raise PermissionDenied
    category.delete()
    return redirect('categories')

@login_required(login_url='login')
def posts(request):
    if request.user.is_staff:
        posts = Blog.objects.all()
    else:
        posts = Blog.objects.filter(author=request.user)
    context = {
        'posts': posts,
    }
    return render(request, 'dashboard/posts.html', context)

@login_required(login_url='login')
def add_post(request):
    if request.method == 'POST':
        form = BlogPostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.save()
            title = form.cleaned_data['title']
            post.slug = slugify(title) + '-' + str(post.id)
            post.save()
            return redirect('posts')
        else:
            print("form is invalid")
            print(form.errors)

    form = BlogPostForm()
    context = {
        'form': form,
    }
    return render(request, 'dashboard/add_post.html', context)

@login_required(login_url='login')
def edit_post(request, pk):
    post = get_object_or_404(Blog, pk=pk)
    if not request.user.is_staff and post.author != request.user:
        raise PermissionDenied

    if request.method == 'POST':
        form = BlogPostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            post = form.save(commit=False)
            title = form.cleaned_data['title']
            post.slug = slugify(title) + '-' + str(post.id)
            post.save()
            return redirect('posts')

    form = BlogPostForm(instance=post)
    context = {
        'form': form,
        'post': post,
    }
    return render(request, 'dashboard/edit_post.html', context)

@login_required(login_url='login')
def delete_post(request, pk):
    post = get_object_or_404(Blog, pk=pk)
    if not request.user.is_staff and post.author != request.user:
        raise PermissionDenied
    post.delete()
    return redirect('posts')

@login_required(login_url='login')
def users(request):
    if not request.user.is_staff:
        raise PermissionDenied
    users = User.objects.all()
    context = {
        'users': users,
    }
    return render(request, 'dashboard/users.html', context)

@login_required(login_url='login')
def add_user(request):
    if not request.user.is_staff:
        raise PermissionDenied
    if request.method == 'POST':
        form = AddUserForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('users')
        else:
            print(form.errors)
            
    form = AddUserForm()
    context = {
        'form': form,
    }
    return render(request, 'dashboard/add_user.html', context)

@login_required(login_url='login')
def edit_user(request, pk):
    if not request.user.is_staff:
        raise PermissionDenied
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = EditUserForm(request.POST, instance=user)
        if form.is_valid(): 
            form.save()
            return redirect('users')
    form = EditUserForm(instance=user)
    context = {
        'form': form,
    }
    return render(request, 'dashboard/edit_user.html', context)

@login_required(login_url='login')
def delete_user(request, pk):
    if not request.user.is_staff:
        raise PermissionDenied
    user = get_object_or_404(User, pk=pk)
    user.delete()
    return redirect('users')
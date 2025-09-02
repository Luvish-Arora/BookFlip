const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const message = document.getElementById('message');
const fileList = document.getElementById('fileList');

// User authentication state
let currentUser = null;

// Check user authentication status on page load
checkAuthStatus();

function checkAuthStatus() {
    fetch('/user-status')
        .then(response => response.json())
        .then(data => {
            if (data.logged_in) {
                currentUser = data.user;
                updateUIForLoggedInUser();
                loadFileList();
            } else {
                currentUser = null;
                updateUIForLoggedOutUser();
            }
        })
        .catch(error => {
            console.error('Error checking auth status:', error);
        });
}

function updateUIForLoggedInUser() {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('userBtn').style.display = 'inline-flex';
    document.getElementById('usernameDisplay').textContent = currentUser.username;
}

function updateUIForLoggedOutUser() {
    document.getElementById('loginBtn').style.display = 'inline-flex';
    document.getElementById('userBtn').style.display = 'none';
    document.getElementById('fileList').innerHTML = '';
}

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close user menu when clicking elsewhere
document.addEventListener('click', function(event) {
    const userBtn = document.getElementById('userBtn');
    const userMenu = document.getElementById('userMenu');
    if (userBtn && userMenu && !userBtn.contains(event.target) && !userMenu.contains(event.target)) {
        userMenu.style.display = 'none';
    }
});

// Authentication functions
function switchAuthMode() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authTitle = document.getElementById('authTitle');
    const switchText = document.getElementById('switchAuthText');
    const switchLink = document.getElementById('switchAuthLink');
    const forgotPassword = document.getElementById('forgotPassword');

    if (loginForm.style.display !== 'none') {
        // Switch to register
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authTitle.textContent = '📝 Create Account';
        switchText.innerHTML = 'Already have an account? <a href="#" id="switchAuthLink" style="color: #8b4513; text-decoration: none; font-weight: 500;">Sign in here</a>';
        forgotPassword.style.display = 'none';
    } else {
        // Switch to login
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        authTitle.textContent = '👤 Login to BookFlip';
        switchText.innerHTML = 'Don\'t have an account? <a href="#" id="switchAuthLink" style="color: #8b4513; text-decoration: none; font-weight: 500;">Sign up here</a>';
        forgotPassword.style.display = 'block';
    }

    // Re-attach event listener to the new link
    document.getElementById('switchAuthLink').addEventListener('click', function(e) {
        e.preventDefault();
        switchAuthMode();
    });
}

// Set up auth switch functionality
document.addEventListener('DOMContentLoaded', function() {
    const switchLink = document.getElementById('switchAuthLink');
    if (switchLink) {
        switchLink.addEventListener('click', function(e) {
            e.preventDefault();
            switchAuthMode();
        });
    }
});

// Login form submission
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    currentUser = data.user;
                    closeModal('loginModal');
                    updateUIForLoggedInUser();
                    showMessage(`Welcome back, ${data.user.username}! 👋`, 'success');
                    loadFileList();
                } else {
                    showAuthMessage(data.error, 'error');
                }
            })
            .catch(error => {
                showAuthMessage('Login failed. Please try again.', 'error');
            });
        });
    }
});

// Register form submission
document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    currentUser = data.user;
                    closeModal('loginModal');
                    updateUIForLoggedInUser();
                    showMessage(`Welcome to BookFlip, ${data.user.username}! 🎉`, 'success');
                    loadFileList();
                } else {
                    showAuthMessage(data.error, 'error');
                }
            })
            .catch(error => {
                showAuthMessage('Registration failed. Please try again.', 'error');
            });
        });
    }
});

function logout() {
    fetch('/logout', {
        method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentUser = null;
            updateUIForLoggedOutUser();
            showMessage('Successfully logged out. See you next time! 👋', 'success');
            const userMenu = document.getElementById('userMenu');
            if (userMenu) {
                userMenu.style.display = 'none';
            }
        }
    })
    .catch(error => {
        console.error('Logout error:', error);
    });
}

function showProfile() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.style.display = 'none';
    }
    showMessage('Profile feature coming soon! 🚧', 'success');
}

function showAuthMessage(text, type) {
    const authMessage = document.getElementById('authMessage');
    if (authMessage) {
        authMessage.textContent = text;
        authMessage.className = `message ${type}`;
        authMessage.style.display = 'block';

        setTimeout(() => {
            authMessage.style.display = 'none';
        }, 5000);
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function scrollToUpload() {
    if (!currentUser) {
        showMessage('Please login to upload files. 🔐', 'error');
        openModal('loginModal');
        return;
    }
    const uploadContainer = document.getElementById('uploadContainer');
    if (uploadContainer) {
        uploadContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Drag and drop functionality
if (uploadSection) {
    uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadSection.classList.add('dragover');
    });

    uploadSection.addEventListener('dragleave', () => {
        uploadSection.classList.remove('dragover');
    });

    uploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
}

// File input change
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

function handleFileSelect(file) {
    if (!currentUser) {
        showMessage('Please login to upload files. 🔐', 'error');
        openModal('loginModal');
        return;
    }

    if (file.type !== 'application/pdf') {
        showMessage('Please select a PDF file.', 'error');
        return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
        showMessage('File too large. Maximum size is 100MB.', 'error');
        return;
    }

    // Show file info
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);
    if (fileInfo) fileInfo.style.display = 'block';

    // Upload file
    uploadFile(file);
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    // Show progress bar
    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';

    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && progressFill) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressFill.style.width = percentComplete + '%';
        }
    });

    xhr.addEventListener('load', () => {
        if (progressBar) progressBar.style.display = 'none';
        
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            showMessage(`📚 "${response.original_filename}" uploaded successfully! Ready to read.`, 'success');
            loadFileList();
        } else {
            const error = JSON.parse(xhr.responseText);
            if (error.login_required) {
                showMessage('Please login to upload files. 🔐', 'error');
                openModal('loginModal');
            } else {
                showMessage('❌ ' + (error.error || 'Upload failed'), 'error');
            }
        }
    });

    xhr.addEventListener('error', () => {
        if (progressBar) progressBar.style.display = 'none';
        showMessage('❌ Upload failed. Please try again.', 'error');
    });

    xhr.open('POST', '/upload');
    xhr.send(formData);
}

function showMessage(text, type) {
    if (message) {
        message.textContent = text;
        message.className = `message ${type}`;
        message.style.display = 'block';

        // Hide message after 5 seconds
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function loadFileList() {
    if (!fileList) return;
    
    fetch('/files')
        .then(response => response.json())
        .then(data => {
            if (data.files && data.files.length > 0) {
                fileList.innerHTML = '<h3>📚 Your Library:</h3>';
                data.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = `
                        <span>${file.filename}</span>
                        <span><strong>${file.size_mb} MB</strong></span>
                    `;
                    fileItem.style.cursor = 'pointer';
                    fileItem.onclick = () => {
                        showMessage(`📖 Opening "${file.filename}"...`, 'success');
                        // Here you would redirect to the reader page
                    };
                    fileList.appendChild(fileItem);
                });
            }
        })
        .catch(error => {
            console.error('Error loading file list:', error);
        });
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close any open modals
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        // Close user menu
        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.style.display = 'none';
        }
    }
});

// Load file list on page load (this will be called after auth check)
// loadFileList(); // This is now called conditionally in checkAuthStatus()
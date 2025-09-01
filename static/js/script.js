// Global variables
        const fileInput = document.getElementById('fileInput');
        const uploadSection = document.getElementById('uploadSection');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        const message = document.getElementById('message');
        const fileList = document.getElementById('fileList');

        // User authentication state - using in-memory storage for demo
        let currentUser = null;
        let userFiles = []; // Simulated file storage

        // Initialize app
        document.addEventListener('DOMContentLoaded', function() {
            checkAuthStatus();
            setupEventListeners();
        });

        function checkAuthStatus() {
            // Simulate checking authentication status
            // In a real app, this would make an API call
            const savedUser = getStoredUser();
            if (savedUser) {
                currentUser = savedUser;
                updateUIForLoggedInUser();
                loadFileList();
            } else {
                currentUser = null;
                updateUIForLoggedOutUser();
            }
        }

        function getStoredUser() {
            // Simulate getting user from storage
            // In a real app, this would check cookies or make an API call
            return null; // Return null for demo - no persistent login
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
            userFiles = [];
        }

        function setupEventListeners() {
            // Drag and drop functionality
            uploadSection.addEventListener('dragover', handleDragOver);
            uploadSection.addEventListener('dragleave', handleDragLeave);
            uploadSection.addEventListener('drop', handleDrop);
            
            // File input change
            fileInput.addEventListener('change', handleFileInputChange);
            
            // Auth form submissions
            document.getElementById('loginForm').addEventListener('submit', handleLogin);
            document.getElementById('registerForm').addEventListener('submit', handleRegister);
            
            // Auth switch functionality
            document.getElementById('switchAuthLink').addEventListener('click', function(e) {
                e.preventDefault();
                switchAuthMode();
            });
            
            // Close user menu when clicking outside
            document.addEventListener('click', function(event) {
                const userBtn = document.getElementById('userBtn');
                const userMenu = document.getElementById('userMenu');
                if (!userBtn.contains(event.target) && !userMenu.contains(event.target)) {
                    userMenu.style.display = 'none';
                }
            });
            
            // Close modal when clicking outside
            window.onclick = function(event) {
                if (event.target.classList.contains('modal')) {
                    event.target.style.display = 'none';
                }
            }
            
            // Keyboard shortcuts
            document.addEventListener('keydown', handleKeyboardShortcuts);
        }

        // Event Handlers
        function handleDragOver(e) {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        }

        function handleDragLeave() {
            uploadSection.classList.remove('dragover');
        }

        function handleDrop(e) {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        }

        function handleFileInputChange(e) {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        }

        function handleKeyboardShortcuts(e) {
            if (e.key === 'Escape') {
                // Close any open modals
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
                // Close user menu
                document.getElementById('userMenu').style.display = 'none';
            }
        }

        // Authentication Functions
        function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            // Simulate login validation
            if (email && password) {
                // For demo purposes, accept any email/password combination
                currentUser = {
                    id: Date.now(),
                    username: email.split('@')[0],
                    email: email
                };
                
                closeModal('loginModal');
                updateUIForLoggedInUser();
                showMessage(`Welcome back, ${currentUser.username}! 👋`, 'success');
                loadFileList();
                clearAuthForms();
            } else {
                showAuthMessage('Please fill in all fields.', 'error');
            }
        }

        function handleRegister(e) {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            
            // Simulate registration validation
            if (username && email && password) {
                if (password.length < 6) {
                    showAuthMessage('Password must be at least 6 characters long.', 'error');
                    return;
                }
                
                // For demo purposes, accept any valid input
                currentUser = {
                    id: Date.now(),
                    username: username,
                    email: email
                };
                
                closeModal('loginModal');
                updateUIForLoggedInUser();
                showMessage(`Welcome to BookFlip, ${currentUser.username}! 🎉`, 'success');
                loadFileList();
                clearAuthForms();
            } else {
                showAuthMessage('Please fill in all fields.', 'error');
            }
        }

        function switchAuthMode() {
            const loginForm = document.getElementById('loginForm');
            const registerForm = document.getElementById('registerForm');
            const authTitle = document.getElementById('authTitle');
            const switchText = document.getElementById('switchAuthText');
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
            
            clearAuthForms();
        }

        function clearAuthForms() {
            // Clear all form inputs
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            
            // Hide auth message
            document.getElementById('authMessage').style.display = 'none';
        }

        function logout() {
            currentUser = null;
            userFiles = [];
            updateUIForLoggedOutUser();
            showMessage('Successfully logged out. See you next time! 👋', 'success');
            document.getElementById('userMenu').style.display = 'none';
        }

        function showProfile() {
            document.getElementById('userMenu').style.display = 'none';
            showMessage('Profile feature coming soon! 🚧', 'success');
        }

        function toggleUserMenu() {
            const menu = document.getElementById('userMenu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }

        // File Handling Functions
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
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            fileInfo.style.display = 'block';

            // Upload file
            uploadFile(file);
        }

        function uploadFile(file) {
            // Show progress bar
            progressBar.style.display = 'block';
            progressFill.style.width = '0%';

            // Simulate file upload progress
            let progress = 0;
            const uploadInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(uploadInterval);
                    
                    // Simulate successful upload
                    setTimeout(() => {
                        progressBar.style.display = 'none';
                        
                        // Add file to user's library
                        const uploadedFile = {
                            id: Date.now(),
                            filename: file.name,
                            originalName: file.name,
                            size: file.size,
                            sizeMB: (file.size / (1024 * 1024)).toFixed(2),
                            uploadDate: new Date(),
                            userId: currentUser.id
                        };
                        
                        userFiles.push(uploadedFile);
                        showMessage(`📚 "${file.name}" uploaded successfully! Ready to read.`, 'success');
                        loadFileList();
                        
                        // Reset file input
                        fileInput.value = '';
                        fileInfo.style.display = 'none';
                    }, 500);
                } else {
                    progressFill.style.width = progress + '%';
                }
            }, 100);
        }

        function loadFileList() {
            if (!currentUser || userFiles.length === 0) {
                fileList.innerHTML = '';
                return;
            }
            
            // Filter files for current user
            const currentUserFiles = userFiles.filter(file => file.userId === currentUser.id);
            
            if (currentUserFiles.length > 0) {
                fileList.innerHTML = '<h3>📚 Your Library:</h3>';
                currentUserFiles.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = `
                        <div>
                            <strong>${file.filename}</strong><br>
                            <small>Uploaded on ${file.uploadDate.toLocaleDateString()}</small>
                        </div>
                        <div>
                            <strong>${file.sizeMB} MB</strong>
                            <button class="btn btn-primary" style="margin-left: 1rem; padding: 0.3rem 0.8rem; font-size: 0.8rem;" onclick="openFile('${file.id}')">
                                📖 Read
                            </button>
                        </div>
                    `;
                    fileList.appendChild(fileItem);
                });
            } else {
                fileList.innerHTML = '<h3>📚 Your Library:</h3><p>No files uploaded yet. Upload your first PDF to get started!</p>';
            }
        }

        function openFile(fileId) {
            const file = userFiles.find(f => f.id == fileId);
            if (file) {
                showMessage(`📖 Opening "${file.filename}"... (Reader feature coming soon!)`, 'success');
                // In a real application, this would navigate to the PDF reader
            }
        }

        // Utility Functions
        function openModal(modalId) {
            document.getElementById(modalId).style.display = 'block';
            
            // Reset forms when opening login modal
            if (modalId === 'loginModal') {
                clearAuthForms();
                // Ensure login form is shown by default
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('registerForm').style.display = 'none';
                document.getElementById('authTitle').textContent = '👤 Login to BookFlip';
                document.getElementById('switchAuthText').innerHTML = 'Don\'t have an account? <a href="#" id="switchAuthLink" style="color: #8b4513; text-decoration: none; font-weight: 500;">Sign up here</a>';
                document.getElementById('forgotPassword').style.display = 'block';
                
                // Re-attach switch event listener
                document.getElementById('switchAuthLink').addEventListener('click', function(e) {
                    e.preventDefault();
                    switchAuthMode();
                });
            }
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

        function scrollToUpload() {
            if (!currentUser) {
                showMessage('Please login to upload files. 🔐', 'error');
                openModal('loginModal');
                return;
            }
            document.getElementById('uploadContainer').scrollIntoView({ behavior: 'smooth' });
        }

        function showMessage(text, type) {
            message.textContent = text;
            message.className = `message ${type}`;
            message.style.display = 'block';

            // Hide message after 5 seconds
            setTimeout(() => {
                message.style.display = 'none';
            }, 5000);
        }

        function showAuthMessage(text, type) {
            const authMessage = document.getElementById('authMessage');
            authMessage.textContent = text;
            authMessage.className = `message ${type}`;
            authMessage.style.display = 'block';

            setTimeout(() => {
                authMessage.style.display = 'none';
            }, 5000);
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
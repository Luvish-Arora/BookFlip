// Global variables
        const fileId = '{{ file_id }}';
        let currentPage = 1;
        let totalPages = 0;
        const pageCache = new Map();

        // Initialize the book reader
        async function initializeBook() {
            try {
                // Get total pages
                const response = await fetch(`/api/book/${fileId}/pages`);
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load book');
                }
                
                totalPages = data.total_pages;
                document.getElementById('totalPagesDisplay').textContent = totalPages;
                
                // Load first two pages
                await loadCurrentPages();
                
            } catch (error) {
                showError('Failed to initialize book: ' + error.message);
            }
        }

        // Load current page(s) for book view
        async function loadCurrentPages() {
            const leftPageNum = currentPage;
            const rightPageNum = currentPage + 1;
            
            // Add page turning animation
            const book = document.querySelector('.book');
            book.classList.add('page-turning');
            setTimeout(() => book.classList.remove('page-turning'), 600);
            
            // Load left page
            if (leftPageNum <= totalPages) {
                loadPageImage('leftPage', leftPageNum);
            } else {
                document.getElementById('leftPage').innerHTML = '<div style="color: #8b4513; font-family: \'Crimson Text\', serif; text-align: center;">No more pages</div>';
            }
            
            // Load right page
            if (rightPageNum <= totalPages) {
                loadPageImage('rightPage', rightPageNum);
            } else {
                document.getElementById('rightPage').innerHTML = '<div style="color: #8b4513; font-family: \'Crimson Text\', serif; text-align: center;">End of book</div>';
            }
            
            updateNavigation();
        }

        // Load a single page image
        async function loadPageImage(elementId, pageNum) {
            const element = document.getElementById(elementId);
            
            try {
                // Show loading
                element.innerHTML = `
                    <div class="page-loading">
                        <div class="spinner"></div>
                        <div>Loading page ${pageNum}...</div>
                    </div>
                `;
                
                // Check cache first
                if (pageCache.has(pageNum)) {
                    const imageData = pageCache.get(pageNum);
                    element.innerHTML = `
                        <img src="${imageData}" alt="Page ${pageNum}">
                        <div class="page-number">${pageNum}</div>
                    `;
                    return;
                }
                
                // Fetch page from server
                const response = await fetch(`/api/book/${fileId}/page/${pageNum}`);
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load page');
                }
                
                // Cache and display the image
                pageCache.set(pageNum, data.image);
                element.innerHTML = `
                    <img src="${data.image}" alt="Page ${pageNum}">
                    <div class="page-number">${pageNum}</div>
                `;
                
            } catch (error) {
                element.innerHTML = `<div style="color: #8b4513; font-family: 'Crimson Text', serif; text-align: center; padding: 20px;">Error loading page ${pageNum}:<br>${error.message}</div>`;
            }
        }

        // Navigation functions
        function nextPage() {
            if (currentPage + 2 <= totalPages) {
                currentPage += 2;
                loadCurrentPages();
            }
        }

        function previousPage() {
            if (currentPage > 1) {
                currentPage = Math.max(1, currentPage - 2);
                loadCurrentPages();
            }
        }

        function updateNavigation() {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            const currentPageDisplay = document.getElementById('currentPageDisplay');
            
            // Update page display
            const leftPage = currentPage;
            const rightPage = Math.min(currentPage + 1, totalPages);
            currentPageDisplay.textContent = leftPage === rightPage ? leftPage : `${leftPage}-${rightPage}`;
            
            // Update button states
            prevBtn.disabled = currentPage <= 1;
            nextBtn.disabled = currentPage + 1 >= totalPages;
        }

        function showError(message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
            
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }

        // Keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                nextPage();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                previousPage();
            } else if (e.key === 'Escape') {
                window.location.href = '/';
            }
        });

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', initializeBook);
// Global variables
const fileId = '{{ file_id }}';
let totalPages = 0;
let currentPageNum = 1;

// Initialize the book reader with linked list
async function initializeBook() {
    try {
        showLoading('Initializing book reader...');
        
        // Initialize PDF with linked list structure
        const response = await fetch(`/api/book/${fileId}/initialize`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to initialize book');
        }
        
        totalPages = data.total_pages;
        document.getElementById('totalPagesDisplay').textContent = totalPages;
        
        // Load first spread using linked list
        await loadCurrentSpread();
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        showError('Failed to initialize book: ' + error.message);
    }
}

// Load current spread using linked list
async function loadCurrentSpread() {
    try {
        showPageTransition();
        
        const response = await fetch(`/api/book/${fileId}/current-spread`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load pages');
        }
        
        currentPageNum = data.current_page_num;
        
        // Update left page
        const leftPageElement = document.getElementById('leftPage');
        if (data.left_page) {
            leftPageElement.innerHTML = `
                <img src="${data.left_page.image_data}" alt="Page ${data.left_page.page_number}">
                <div class="page-number">${data.left_page.page_number}</div>
            `;
        } else {
            leftPageElement.innerHTML = '<div class="empty-page">No page</div>';
        }
        
        // Update right page
        const rightPageElement = document.getElementById('rightPage');
        if (data.right_page) {
            rightPageElement.innerHTML = `
                <img src="${data.right_page.image_data}" alt="Page ${data.right_page.page_number}">
                <div class="page-number">${data.right_page.page_number}</div>
            `;
        } else {
            rightPageElement.innerHTML = '<div class="empty-page">End of book</div>';
        }
        
        updateNavigation();
        hidePageTransition();
        
    } catch (error) {
        hidePageTransition();
        showError('Failed to load pages: ' + error.message);
    }
}

// Navigation functions using linked list
async function nextPage() {
    try {
        const response = await fetch(`/api/book/${fileId}/navigate/next`);
        const data = await response.json();
        
        if (!data.success) {
            if (data.error.includes('Cannot navigate')) {
                return; // Already at end
            }
            throw new Error(data.error);
        }
        
        // Update display with new spread data
        await updateSpreadFromData(data);
        
    } catch (error) {
        showError('Failed to navigate: ' + error.message);
    }
}

async function previousPage() {
    try {
        const response = await fetch(`/api/book/${fileId}/navigate/prev`);
        const data = await response.json();
        
        if (!data.success) {
            if (data.error.includes('Cannot navigate')) {
                return; // Already at beginning
            }
            throw new Error(data.error);
        }
        
        // Update display with new spread data
        await updateSpreadFromData(data);
        
    } catch (error) {
        showError('Failed to navigate: ' + error.message);
    }
}

async function goToPage(pageNumber) {
    try {
        showPageTransition();
        
        const response = await fetch(`/api/book/${fileId}/goto/${pageNumber}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        await updateSpreadFromData(data);
        
    } catch (error) {
        hidePageTransition();
        showError('Failed to go to page: ' + error.message);
    }
}

// Helper function to update spread from API data
async function updateSpreadFromData(data) {
    currentPageNum = data.current_page_num;
    
    // Update left page
    const leftPageElement = document.getElementById('leftPage');
    if (data.left_page) {
        leftPageElement.innerHTML = `
            <img src="${data.left_page.image_data}" alt="Page ${data.left_page.page_number}">
            <div class="page-number">${data.left_page.page_number}</div>
        `;
    } else {
        leftPageElement.innerHTML = '<div class="empty-page">No page</div>';
    }
    
    // Update right page
    const rightPageElement = document.getElementById('rightPage');
    if (data.right_page) {
        rightPageElement.innerHTML = `
            <img src="${data.right_page.image_data}" alt="Page ${data.right_page.page_number}">
            <div class="page-number">${data.right_page.page_number}</div>
        `;
    } else {
        rightPageElement.innerHTML = '<div class="empty-page">End of book</div>';
    }
    
    updateNavigation();
    hidePageTransition();
}

// Update navigation buttons and page display
function updateNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const currentPageDisplay = document.getElementById('currentPageDisplay');
    
    // Calculate right page number
    const rightPageNum = Math.min(currentPageNum + 1, totalPages);
    
    // Update page display
    if (currentPageNum === rightPageNum) {
        currentPageDisplay.textContent = currentPageNum;
    } else {
        currentPageDisplay.textContent = `${currentPageNum}-${rightPageNum}`;
    }
    
    // Update button states
    prevBtn.disabled = currentPageNum <= 1;
    nextBtn.disabled = currentPageNum >= totalPages;
}

// UI Helper functions
function showLoading(message = 'Loading...') {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingOverlay';
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <div class="loading-text">${message}</div>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function showPageTransition() {
    const book = document.querySelector('.book');
    book.classList.add('page-turning');
}

function hidePageTransition() {
    const book = document.querySelector('.book');
    book.classList.remove('page-turning');
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-icon">⚠</span>
            <span class="error-text">${message}</span>
            <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Page input functionality
function createPageInput() {
    const pageInfo = document.querySelector('.page-info');
    const currentDisplay = document.getElementById('currentPageDisplay');
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 1;
    input.max = totalPages;
    input.value = currentPageNum;
    input.className = 'page-input';
    input.style.width = currentDisplay.offsetWidth + 'px';
    
    // Replace display with input
    currentDisplay.style.display = 'none';
    pageInfo.insertBefore(input, currentDisplay);
    input.focus();
    input.select();
    
    // Handle input events
    input.addEventListener('blur', handlePageInputSubmit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            handlePageInputSubmit();
        } else if (e.key === 'Escape') {
            cancelPageInput();
        }
    });
    
    function handlePageInputSubmit() {
        const newPage = parseInt(input.value);
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPageNum) {
            goToPage(newPage);
        }
        cancelPageInput();
    }
    
    function cancelPageInput() {
        input.remove();
        currentDisplay.style.display = 'inline';
    }
}

// Event Listeners

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextPage();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousPage();
    } else if (e.key === 'Escape') {
        // Cleanup session before leaving
        fetch(`/api/book/${fileId}/cleanup`, { method: 'POST' });
        window.location.href = '/';
    } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        createPageInput();
    }
});

// Click on page display to edit
document.addEventListener('DOMContentLoaded', function() {
    const currentPageDisplay = document.getElementById('currentPageDisplay');
    if (currentPageDisplay) {
        currentPageDisplay.addEventListener('click', createPageInput);
        currentPageDisplay.style.cursor = 'pointer';
        currentPageDisplay.title = 'Click to go to page';
    }
});

// Touch/swipe support for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swiped left - next page
            nextPage();
        } else {
            // Swiped right - previous page
            previousPage();
        }
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    fetch(`/api/book/${fileId}/cleanup`, { method: 'POST' });
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeBook);
/* ===========================
   BookFlip - script.js (Complete)
   - Single file that includes:
     Auth, Modals, Upload (drag-n-drop + progress), Library (cards), Select/Delete
   - Uses safe DOM creation, credentials: 'same-origin', and robust error logging
   =========================== */

'use strict';

/* --------------------------
   Cached DOM nodes (may be null)
   -------------------------- */
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const fileInfo = document.getElementById('fileInfo');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const messageBox = document.getElementById('message') || document.getElementById('messageBox');
const fileList = document.getElementById('fileList');       // main card-style library
const libraryList = document.getElementById('libraryList'); // optional simple list (sidebar)
const loginBtn = document.getElementById('loginBtn');
const userBtn = document.getElementById('userBtn');
const usernameDisplay = document.getElementById('usernameDisplay');

/* --------------------------
   App state
   -------------------------- */
let currentUser = null;

/* --------------------------
   Startup
   -------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  attachGlobalHandlers();
  attachModalHandlers();
  attachUploadHandlers();
  checkAuthStatus(); // will call loadLibrary if logged in
});

/* ==========================
   AUTH
   ========================== */
function checkAuthStatus() {
  fetch('/user-status', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(data => {
      if (data.logged_in) {
        currentUser = data.user;
        updateAuthUI(true);
        loadLibrary();
      } else {
        currentUser = null;
        updateAuthUI(false);
      }
    })
    .catch(err => {
      console.error('checkAuthStatus error:', err);
      currentUser = null;
      updateAuthUI(false);
    });
}

function updateAuthUI(loggedIn) {
  // show/hide buttons & username
  if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : 'inline-flex';
  if (userBtn) userBtn.style.display = loggedIn ? 'inline-flex' : 'none';
  if (usernameDisplay) usernameDisplay.textContent = loggedIn && currentUser ? (currentUser.username || currentUser.email || '') : '';

  // clear library when logged out
  if (!loggedIn) {
    if (fileList) fileList.innerHTML = '';
    if (libraryList) libraryList.innerHTML = '';
  }
}

async function logout() {
  try {
    const res = await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
    const data = await res.json();
    if (data.success) {
      currentUser = null;
      updateAuthUI(false);
      showMessage('Successfully logged out. See you next time!', 'success');
      const userMenu = document.getElementById('userMenu');
      if (userMenu) userMenu.style.display = 'none';
    } else {
      showMessage('Logout failed', 'error');
    }
  } catch (err) {
    console.error('logout error:', err);
    showMessage('Logout error', 'error');
  }
}

/* ==========================
   MODALS & AUTH FORMS
   ========================== */
function attachModalHandlers() {
  // Switch auth mode link(s)
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'switchAuthLink') {
      e.preventDefault();
      switchAuthMode();
    }
  });

  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('loginEmail') || {}).value || '';
      const password = (document.getElementById('loginPassword') || {}).value || '';
      try {
        const res = await fetch('/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          currentUser = data.user;
          closeModal('loginModal');
          updateAuthUI(true);
          showMessage(`Welcome back, ${data.user.username}!`, 'success');
          loadLibrary();
        } else {
          showAuthMessage(data.error || 'Login failed', 'error');
        }
      } catch (err) {
        console.error('Login error:', err);
        showAuthMessage('Login failed. Please try again.', 'error');
      }
    });
  }

  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (document.getElementById('registerUsername') || {}).value || '';
      const email = (document.getElementById('registerEmail') || {}).value || '';
      const password = (document.getElementById('registerPassword') || {}).value || '';
      try {
        const res = await fetch('/register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (data.success) {
          currentUser = data.user;
          closeModal('loginModal');
          updateAuthUI(true);
          showMessage(`Welcome to BookFlip, ${data.user.username}!`, 'success');
          loadLibrary();
        } else {
          showAuthMessage(data.error || 'Registration failed', 'error');
        }
      } catch (err) {
        console.error('Register error:', err);
        showAuthMessage('Registration failed. Please try again.', 'error');
      }
    });
  }

  // Close user menu when clicking outside
  document.addEventListener('click', function(event) {
    const userBtn = document.getElementById('userBtn');
    const userMenu = document.getElementById('userMenu');
    if (userBtn && userMenu && !userBtn.contains(event.target) && !userMenu.contains(event.target)) {
      userMenu.style.display = 'none';
    }
  });

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target && event.target.classList && event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });
}

function switchAuthMode() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authTitle = document.getElementById('authTitle');
  const switchText = document.getElementById('switchAuthText');
  const forgotPassword = document.getElementById('forgotPassword');

  if (!loginForm || !registerForm || !authTitle || !switchText) return;

  if (loginForm.style.display !== 'none') {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    authTitle.textContent = '📝 Create Account';
    switchText.innerHTML = 'Already have an account? <a href="#" id="switchAuthLink" style="color: #8b4513;">Sign in here</a>';
    if (forgotPassword) forgotPassword.style.display = 'none';
  } else {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    authTitle.textContent = '👤 Login to BookFlip';
    switchText.innerHTML = 'Don\'t have an account? <a href="#" id="switchAuthLink" style="color: #8b4513;">Sign up here</a>';
    if (forgotPassword) forgotPassword.style.display = 'block';
  }
}

function showAuthMessage(text, type) {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

/* ==========================
   UPLOAD (drag/drop + file input + xhr progress)
   ========================== */
function attachUploadHandlers() {
  // drag & drop
  if (uploadSection) {
    uploadSection.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadSection.classList.add('dragover');
    });
    uploadSection.addEventListener('dragleave', () => uploadSection.classList.remove('dragover'));
    uploadSection.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadSection.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files && files[0]) handleFileSelect(files[0]);
    });
  }

  // file input change
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0]);
    });
  }

  // optional upload form submit (if present)
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        showMessage('Please select a file', 'error');
        return;
      }
      handleFileSelect(fileInput.files[0]);
    });
  }
}

function handleFileSelect(file) {
  if (!currentUser) {
    showMessage('Please login to upload files.', 'error');
    openModal('loginModal');
    return;
  }
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showMessage('Please select a PDF file.', 'error');
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    showMessage('File too large. Maximum size is 100MB.', 'error');
    return;
  }

  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = formatFileSize(file.size);
  if (fileInfo) fileInfo.style.display = 'block';

  uploadFileWithRedirect(file);
}

function uploadFileWithRedirect(file) {
  const fd = new FormData();
  fd.append('file', file);

  if (progressBar) progressBar.style.display = 'block';
  if (progressFill) progressFill.style.width = '0%';

  const xhr = new XMLHttpRequest();
  xhr.withCredentials = true;

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable && progressFill) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
    }
  });

  xhr.addEventListener('load', () => {
    if (progressBar) progressBar.style.display = 'none';
    try {
      const resp = JSON.parse(xhr.responseText || '{}');
      if (xhr.status === 200 && resp.success) {
        showMessage(`"${resp.original_filename}" uploaded successfully! Redirecting...`, 'success');
        // clear UI
        if (fileInput) fileInput.value = '';
        if (fileInfo) fileInfo.style.display = 'none';
        // redirect to reader
        setTimeout(() => { window.location.href = `/book/${resp.file_id}`; }, 800);
      } else {
        if (resp && resp.login_required) {
          showMessage('Please login to upload files.', 'error');
          openModal('loginModal');
        } else {
          showMessage(resp.error || resp.message || 'Upload failed', 'error');
        }
      }
    } catch (err) {
      console.error('Upload parse error:', err, xhr.responseText);
      showMessage('Upload failed (invalid server response)', 'error');
    }
  });

  xhr.addEventListener('error', () => {
    if (progressBar) progressBar.style.display = 'none';
    showMessage('Upload failed. Please try again.', 'error');
  });

  xhr.open('POST', '/upload');
  xhr.send(fd);
}

/* ==========================
   LIBRARY (fetch & render as cards; supports /files and /get-files)
   ========================== */
function loadLibrary() {
  if (!fileList && !libraryList) return;
  if (!currentUser) {
    if (fileList) fileList.innerHTML = '';
    if (libraryList) libraryList.innerHTML = '';
    return;
  }

  const target = fileList || libraryList;
  target.innerHTML = `<div style="padding:18px; text-align:center; color:#8b4513">Loading your library...</div>`;

  const endpoints = ['/files', '/get-files'];
  let idx = 0;

  function fetchAttempt() {
    const endpoint = endpoints[idx];
    console.log('Fetching library from', endpoint);
    fetch(endpoint, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          // try to parse error message
          const err = await res.json().catch(()=>({}));
          return Promise.reject(err);
        }
        return res.json();
      })
      .then(data => {
        // backend returns { files: [...] } (preferred) or an array directly
        const files = (data && data.files) ? data.files : (Array.isArray(data) ? data : []);
        renderFiles(files);
      })
      .catch(err => {
        console.warn('Library fetch error for', endpoint, err);
        idx++;
        if (idx < endpoints.length) {
          fetchAttempt();
        } else {
          target.innerHTML = `<div style="padding:18px; text-align:center; color:#dc3545">Error loading your library. Check console.</div>`;
        }
      });
  }

  fetchAttempt();
}

function renderFiles(files) {
  const target = fileList || libraryList;
  target.innerHTML = '';

  if (!Array.isArray(files) || files.length === 0) {
    target.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:#8b4513; font-family:'Crimson Text', serif;">
        📚 No PDF files uploaded yet<br>
        <small style="color:#8b4513; margin-top:10px; display:block;">Upload your first PDF to start building your library!</small>
      </div>`;
    return;
  }

  // If using fileList (card UI), render cards. Otherwise render simple li entries in libraryList.
  if (fileList) {
    // header
    const header = document.createElement('h3');
    header.style.cssText = "color: #2c1810; font-family: 'Crimson Text', serif; text-align:center; margin-bottom:1rem;";
    header.textContent = '📚 Your Library';
    fileList.appendChild(header);
  }

  files.forEach(f => {
    const fileId = f.file_id || f.fileId || f.id || f.filename || f.original_filename;
    const filename = f.filename || f.original_filename || f.book_title || 'Unknown File';
    const sizeDisplay = f.file_size_display || f.size_display || (f.file_size ? formatFileSize(f.file_size) : 'Unknown size');
    const uploadDate = f.upload_date || (f.upload_date ? f.upload_date : null);
    const lastRead = f.last_read || null;

    if (fileList) {
      const card = document.createElement('div');
      card.className = 'file-item';
      card.dataset.fileId = fileId;
      card.style.cssText = `
        display:flex; justify-content:space-between; align-items:center; padding:20px; margin:12px 0;
        background: linear-gradient(135deg, rgba(244,228,188,0.8), rgba(210,105,30,0.08)); border-radius:12px;
        border:1px solid rgba(139,69,19,0.12);
      `;

      // info
      const info = document.createElement('div');
      info.style.flex = '1';
      info.style.paddingRight = '16px';

      const nameDiv = document.createElement('div');
      nameDiv.style.cssText = "font-family:'Crimson Text', serif; font-size:1.1rem; font-weight:600; color:#2c1810; display:flex; gap:10px; align-items:center;";
      const icon = document.createElement('span'); icon.textContent = '📄'; icon.style.fontSize = '1.2rem';
      const nameText = document.createElement('span'); nameText.textContent = filename; nameText.title = filename;
      nameDiv.appendChild(icon); nameDiv.appendChild(nameText);

      const metaDiv = document.createElement('div');
      metaDiv.style.cssText = "font-size:0.9rem; color:#8b4513; margin-top:6px;";
      metaDiv.textContent = `${sizeDisplay} • ${uploadDate ? 'Uploaded ' + uploadDate : 'No date'} • ${lastRead ? 'Last read ' + lastRead : 'Never read'}`;

      info.appendChild(nameDiv);
      info.appendChild(metaDiv);

      // actions
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '10px';
      actions.style.flexShrink = '0';

      const openBtn = document.createElement('button');
      openBtn.className = 'btn btn-primary';
      openBtn.style.cssText = 'padding:10px 18px; border-radius:22px; cursor:pointer;';
      openBtn.textContent = '📖 Open';
      openBtn.addEventListener('click', () => selectFileFromLibrary(String(fileId), filename));

      const deleteBtn = document.createElement('button');
      deleteBtn.style.cssText = 'padding:10px 18px; border-radius:22px; cursor:pointer; background:linear-gradient(45deg,#dc3545,#c82333); color:white;';
      deleteBtn.textContent = '🗑️ Delete';
      deleteBtn.addEventListener('click', () => deleteFile(String(fileId), card));

      actions.appendChild(openBtn);
      actions.appendChild(deleteBtn);

      card.appendChild(info);
      card.appendChild(actions);
      fileList.appendChild(card);
    } else if (libraryList) {
      const li = document.createElement('li');
      li.className = 'library-item';
      li.dataset.id = fileId;
      const span = document.createElement('span');
      span.className = 'file-name';
      span.textContent = filename;
      const openBtn = document.createElement('button');
      openBtn.textContent = '📖 Open';
      openBtn.addEventListener('click', () => openFile(fileId));
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️ Delete';
      delBtn.addEventListener('click', () => deleteFile(fileId));
      li.appendChild(span);
      li.appendChild(openBtn);
      li.appendChild(delBtn);
      libraryList.appendChild(li);
    }
  });
}

/* ==========================
   SELECT / OPEN / DELETE
   ========================== */

async function selectFileFromLibrary(fileId, filename) {
  try {
    showMessage(`Opening "${filename}"...`, 'success');
    const res = await fetch(`/select-file/${encodeURIComponent(fileId)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      window.location.href = data.redirect_url || `/book/${fileId}`;
    } else {
      throw new Error(data.error || 'Failed to open file');
    }
  } catch (err) {
    console.error('selectFileFromLibrary error:', err);
    // fallback: try direct book route
    window.location.href = `/book/${encodeURIComponent(fileId)}`;
  }
}

function openFile(id) {
  window.location.href = `/reader/${encodeURIComponent(id)}`;
}

async function deleteFile(fileId, cardElement = null) {
  if (!confirm('Are you sure you want to delete this file?')) return;
  try {
    const res = await fetch(`/delete-file/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showMessage('File deleted successfully', 'success');
      // remove item from DOM (cardElement provided by render)
      if (cardElement && cardElement.remove) cardElement.remove();
      else {
        // try to find by data attribute
        const selector = `[data-file-id="${escapeCssValue(fileId)}"], [data-id="${escapeCssValue(fileId)}"], [data-id='${fileId}']`;
        const el = document.querySelector(selector);
        if (el && el.remove) el.remove();
      }
      // if nothing left, show empty state
      const target = fileList || libraryList;
      if (target && !target.querySelector('.file-item') && !target.querySelector('.library-item')) {
        loadLibrary();
      }
    } else {
      showMessage(data.error || 'Delete failed', 'error');
    }
  } catch (err) {
    console.error('deleteFile error:', err);
    showMessage('Error deleting file', 'error');
  }
}

/* ==========================
   HELPERS & UI
   ========================== */
function showMessage(text, type = 'info') {
  if (!messageBox) {
    console.log(`[${type}] ${text}`);
    return;
  }
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  messageBox.style.display = 'block';
  clearTimeout(showMessage._timer);
  showMessage._timer = setTimeout(() => { messageBox.style.display = 'none'; }, type === 'error' ? 5000 : 3000);
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k,i)).toFixed(2)) + ' ' + sizes[i];
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'block';
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

/* --------------------------
   Utility: escape for CSS selectors
   -------------------------- */
function escapeCssValue(val) {
  // try using CSS.escape if available, otherwise fallback simple replace
  if (window.CSS && CSS.escape) return CSS.escape(val);
  return String(val).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');
}

/* ==========================
   GLOBAL HANDLERS (keyboard, etc.)
   ========================== */
function attachGlobalHandlers() {
  // Escape to close modals and user menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
      const userMenu = document.getElementById('userMenu');
      if (userMenu) userMenu.style.display = 'none';
    }
  });

  // Close modals by clicking outside handled in attachModalHandlers

  // Optional: allow clicking userBtn to toggle menu
  if (userBtn) {
    userBtn.addEventListener('click', () => {
      const menu = document.getElementById('userMenu');
      if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
  }
}

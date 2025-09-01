from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import sqlite3
from datetime import datetime
from functools import wraps

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max file size
DATABASE = 'bookflip.db'

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.secret_key = 'your-secret-key-change-this-in-production'  # Change this in production!

# Database initialization
def init_db():
    """Initialize the database with required tables"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(80) UNIQUE NOT NULL,
            email VARCHAR(120) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Files table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            file_id VARCHAR(50) UNIQUE NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            stored_filename VARCHAR(255) NOT NULL,
            file_size INTEGER NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Create uploads folder if it doesn't exist
def create_upload_folder():
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
        print(f"Created uploads folder: {UPLOAD_FOLDER}")

def allowed_file(filename):
    """Check if the uploaded file is a PDF"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required', 'login_required': True}), 401
        return f(*args, **kwargs)
    return decorated_function

# Helper function to get database connection
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    """Handle user registration"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        # Validation
        if not username or not email or not password:
            return jsonify({'error': 'All fields are required'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        
        # Check if user already exists
        conn = get_db()
        existing_user = conn.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            (username, email)
        ).fetchone()
        
        if existing_user:
            conn.close()
            return jsonify({'error': 'Username or email already exists'}), 400
        
        # Create new user
        password_hash = generate_password_hash(password)
        cursor = conn.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Log in the user
        session['user_id'] = user_id
        session['username'] = username
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'user': {'id': user_id, 'username': username, 'email': email}
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@app.route('/login', methods=['POST'])
def login():
    """Handle user login"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Check user credentials
        conn = get_db()
        user = conn.execute(
            'SELECT id, username, email, password_hash FROM users WHERE email = ?',
            (email,)
        ).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            # Login successful
            session['user_id'] = user['id']
            session['username'] = user['username']
            
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}
            }), 200
        else:
            return jsonify({'error': 'Invalid email or password'}), 401
            
    except Exception as e:
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/logout', methods=['POST'])
def logout():
    """Handle user logout"""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200

@app.route('/user-status')
def user_status():
    """Check if user is logged in"""
    if 'user_id' in session:
        return jsonify({
            'logged_in': True,
            'user': {
                'id': session['user_id'],
                'username': session['username']
            }
        })
    else:
        return jsonify({'logged_in': False})

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Handle PDF file upload - requires authentication"""
    try:
        # Check if the post request has the file part
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
        
        file = request.files['file']
        
        # Check if user selected a file
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check if file is allowed
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        if file:
            # Create uploads folder if it doesn't exist
            create_upload_folder()
            
            # Generate unique filename to avoid conflicts
            file_id = str(uuid.uuid4())
            original_filename = secure_filename(file.filename)
            stored_filename = f"{file_id}_{original_filename}"
            
            # Save file
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], stored_filename)
            file.save(filepath)
            
            # Get file size
            file_size = os.path.getsize(filepath)
            
            # Save file info to database
            conn = get_db()
            conn.execute(
                '''INSERT INTO files (user_id, file_id, original_filename, stored_filename, file_size)
                   VALUES (?, ?, ?, ?, ?)''',
                (session['user_id'], file_id, original_filename, stored_filename, file_size)
            )
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'message': 'File uploaded successfully',
                'file_id': file_id,
                'original_filename': original_filename,
                'filename': stored_filename,
                'file_size': file_size,
                'filepath': filepath
            }), 200
            
    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/files')
@login_required
def list_files():
    """List all uploaded PDF files for the current user"""
    try:
        conn = get_db()
        files = conn.execute(
            '''SELECT file_id, original_filename, stored_filename, file_size, upload_date
               FROM files WHERE user_id = ? ORDER BY upload_date DESC''',
            (session['user_id'],)
        ).fetchall()
        conn.close()
        
        file_list = []
        for file in files:
            file_list.append({
                'file_id': file['file_id'],
                'filename': file['original_filename'],
                'stored_filename': file['stored_filename'],
                'size': file['file_size'],
                'size_mb': round(file['file_size'] / (1024*1024), 2),
                'upload_date': file['upload_date']
            })
        
        return jsonify({'files': file_list})
    except Exception as e:
        return jsonify({'error': f'Failed to list files: {str(e)}'}), 500

@app.route('/delete-file/<file_id>', methods=['DELETE'])
@login_required
def delete_file(file_id):
    """Delete a file - only the owner can delete"""
    try:
        conn = get_db()
        
        # Check if file belongs to current user
        file_info = conn.execute(
            'SELECT stored_filename FROM files WHERE file_id = ? AND user_id = ?',
            (file_id, session['user_id'])
        ).fetchone()
        
        if not file_info:
            conn.close()
            return jsonify({'error': 'File not found or access denied'}), 404
        
        # Delete from database
        conn.execute(
            'DELETE FROM files WHERE file_id = ? AND user_id = ?',
            (file_id, session['user_id'])
        )
        conn.commit()
        conn.close()
        
        # Delete physical file
        try:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info['stored_filename'])
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not delete physical file: {e}")
        
        return jsonify({'success': True, 'message': 'File deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500

# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 100MB'}), 413

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize database and create upload folder on startup
    init_db()
    create_upload_folder()
    print(f"Starting Flask server...")
    print(f"Database: {os.path.abspath(DATABASE)}")
    print(f"Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    app.run(debug=True, host='0.0.0.0', port=5000)
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import mysql.connector
from mysql.connector import Error
from datetime import datetime
from functools import wraps
import sys
print("Running with:", sys.executable)
import fitz  

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max file size

# MySQL Database Configuration
DB_CONFIG = {
    'host': 'localhost',  # Change this to your MySQL host
    'database': 'luvishdb',
    'user': 'root',  # Change this to your MySQL username
    'password': '123456',  # Change this to your MySQL password
    'port': 3306,  # MySQL port (default is 3306)
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.secret_key = 'your-secret-key-change-this-in-production'  # Change this in production!

# Database connection helper
def get_db_connection():
    """Get MySQL database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def init_db():
    """Initialize the database with required tables"""
    try:
        connection = get_db_connection()
        if connection is None:
            print("❌ Failed to connect to database for initialization")
            return False
        
        cursor = connection.cursor()
        print("🔧 Creating database tables...")
        
        # Enhanced users table (renamed from 'user' to 'users' for better naming)
        try:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(80) UNIQUE NOT NULL,
                    email VARCHAR(120) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            print("✅ Users table created/verified")
        except Error as e:
            print(f"⚠️  Warning: Could not create users table: {e}")
        
        # Enhanced files table (to replace book table with better structure)
        try:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS files (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    file_id VARCHAR(50) UNIQUE NOT NULL,
                    original_filename VARCHAR(255) NOT NULL,
                    stored_filename VARCHAR(255) NOT NULL,
                    file_size BIGINT NOT NULL,
                    file_size_display VARCHAR(20) NOT NULL,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_read DATE DEFAULT NULL,
                    INDEX idx_user_files (user_id),
                    INDEX idx_file_id (file_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            print("✅ Files table created/verified")
            
            # Try to add foreign key constraint separately (in case users table doesn't exist yet)
            try:
                cursor.execute('''
                    ALTER TABLE files 
                    ADD CONSTRAINT fk_files_user 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ''')
            except Error:
                # Foreign key might already exist or users table might not exist
                pass
                
        except Error as e:
            print(f"⚠️  Warning: Could not create files table: {e}")
        
        # Keep existing book table for backward compatibility, but modify it
        try:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS book (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(120) NOT NULL,
                    book_title VARCHAR(255) NOT NULL,
                    size VARCHAR(20) NOT NULL,
                    last_read DATE DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_username (username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            print("✅ Book table created/verified")
        except Error as e:
            print(f"⚠️  Warning: Could not create book table: {e}")
        
        # Also ensure the original 'user' table exists for backward compatibility
        try:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user (
                    username VARCHAR(120) PRIMARY KEY,
                    password VARCHAR(255) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            print("✅ Original user table created/verified")
        except Error as e:
            print(f"⚠️  Warning: Could not create user table: {e}")
        
        connection.commit()
        cursor.close()
        connection.close()
        print("✅ Database tables initialization completed!")
        return True
        
    except Error as e:
        print(f"❌ Database initialization failed: {e}")
        return False

def ensure_table_exists(table_name):
    """Ensure a specific table exists, create if missing"""
    try:
        connection = get_db_connection()
        if connection is None:
            return False
        
        cursor = connection.cursor()
        
        if table_name == 'users':
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(80) UNIQUE NOT NULL,
                    email VARCHAR(120) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            print(f"✅ Table '{table_name}' ensured to exist")
            
        elif table_name == 'files':
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS files (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    file_id VARCHAR(50) UNIQUE NOT NULL,
                    original_filename VARCHAR(255) NOT NULL,
                    stored_filename VARCHAR(255) NOT NULL,
                    file_size BIGINT NOT NULL,
                    file_size_display VARCHAR(20) NOT NULL,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_read DATE DEFAULT NULL,
                    INDEX idx_user_files (user_id),
                    INDEX idx_file_id (file_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            # Try to add foreign key constraint if users table exists
            try:
                cursor.execute('SELECT 1 FROM users LIMIT 1')
                cursor.execute('''
                    ALTER TABLE files 
                    ADD CONSTRAINT fk_files_user 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ''')
            except Error:
                pass  # Foreign key might already exist or users table might not exist
            print(f"✅ Table '{table_name}' ensured to exist")
            
        elif table_name == 'book':
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS book (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(120) NOT NULL,
                    book_title VARCHAR(255) NOT NULL,
                    size VARCHAR(20) NOT NULL,
                    last_read DATE DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_username (username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            print(f"✅ Table '{table_name}' ensured to exist")
            
        elif table_name == 'user':
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user (
                    username VARCHAR(120) PRIMARY KEY,
                    password VARCHAR(255) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ''')
            print(f"✅ Table '{table_name}' ensured to exist")
        
        connection.commit()
        cursor.close()
        connection.close()
        return True
        
    except Error as e:
        print(f"❌ Failed to ensure table '{table_name}' exists: {e}")
        return False

def test_database_connection():
    """Test database connection and show tables content (for startup use)"""
    try:
        connection = get_db_connection()
        if connection is None:
            print("❌ Failed to connect to database")
            return False
        
        cursor = connection.cursor()
        
        # Test connection with users table (preferred) or fallback to user table
        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            users_count = cursor.fetchone()[0]
            table_name = "users"
        except Error:
            try:
                cursor.execute("SELECT COUNT(*) FROM user")
                users_count = cursor.fetchone()[0]
                table_name = "user"
            except Error:
                users_count = 0
                table_name = "none"
        
        # Check files table
        try:
            cursor.execute("SELECT COUNT(*) FROM files")
            files_count = cursor.fetchone()[0]
        except Error:
            files_count = 0
        
        # Check book table
        try:
            cursor.execute("SELECT COUNT(*) FROM book")
            books_count = cursor.fetchone()[0]
        except Error:
            books_count = 0
        
        print("✅ Database connection successful!")
        print(f"📊 Database status:")
        print(f"  - Users table ({table_name}): {users_count} records")
        print(f"  - Files table: {files_count} records")
        print(f"  - Books table: {books_count} records")
        
        cursor.close()
        connection.close()
        return True
        
    except Error as e:
        print(f"❌ Database connection failed: {e}")
        return False

def migrate_user_table():
    """Migrate from old 'user' table to new 'users' table if needed"""
    try:
        connection = get_db_connection()
        if connection is None:
            return False
        
        cursor = connection.cursor()
        
        # Check if old user table exists and new users table is empty
        cursor.execute("SHOW TABLES LIKE 'user'")
        old_table_exists = cursor.fetchone() is not None
        
        if old_table_exists:
            cursor.execute("SELECT COUNT(*) FROM users")
            users_count = cursor.fetchone()[0]
            
            if users_count == 0:
                print("🔄 Migrating from 'user' table to 'users' table...")
                # Migrate data from user to users table
                cursor.execute("SELECT username, password FROM user")
                old_users = cursor.fetchall()
                
                for old_user in old_users:
                    email = old_user[0]  # username was email in old table
                    username = email.split('@')[0]  # use part before @ as username
                    # Hash the password (old table had plain text passwords)
                    password_hash = generate_password_hash(old_user[1])
                    
                    try:
                        cursor.execute(
                            'INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)',
                            (username, email, password_hash)
                        )
                    except Error as e:
                        print(f"Warning: Could not migrate user {email}: {e}")
                
                connection.commit()
                print(f"✅ Migrated {len(old_users)} users to new table structure")
        
        cursor.close()
        connection.close()
        return True
        
    except Error as e:
        print(f"❌ Migration failed: {e}")
        return False

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

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    """Handle user registration with enhanced validation and password hashing"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        # Enhanced validation
        if not username or not email or not password:
            return jsonify({'error': 'All fields are required'}), 400
        
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        
        if len(password) > 50:
            return jsonify({'error': 'Password must be 50 characters or less'}), 400
        
        if len(email) > 120:
            return jsonify({'error': 'Email must be 120 characters or less'}), 400
        
        if len(username) > 80:
            return jsonify({'error': 'Username must be 80 characters or less'}), 400
        
        # Connect to database
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Check if user already exists
        cursor.execute('SELECT id FROM users WHERE username = %s OR email = %s', (username, email))
        existing_user = cursor.fetchone()
        
        if existing_user:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Username or email already exists'}), 400
        
        # Create new user with hashed password
        password_hash = generate_password_hash(password)
        cursor.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)',
            (username, email, password_hash)
        )
        user_id = cursor.lastrowid
        connection.commit()
        cursor.close()
        connection.close()
        
        # Log in the user
        session['user_id'] = user_id
        session['username'] = username
        session['email'] = email
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'user': {'id': user_id, 'username': username, 'email': email}
        }), 201
        
    except Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@app.route('/login', methods=['POST'])
def login():
    """Handle user login with password hash verification"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Connect to database
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Check user credentials in new users table
        cursor.execute(
            'SELECT id, username, email, password_hash FROM users WHERE email = %s',
            (email,)
        )
        user = cursor.fetchone()
        
        # Fallback to old user table if new table doesn't have the user
        if not user:
            cursor.execute(
                'SELECT username, password FROM user WHERE username = %s',
                (email,)
            )
            old_user = cursor.fetchone()
            if old_user and old_user[1] == password:  # Plain text password in old table
                # Migrate this user to new table
                username = email.split('@')[0]
                password_hash = generate_password_hash(password)
                cursor.execute(
                    'INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)',
                    (username, email, password_hash)
                )
                user_id = cursor.lastrowid
                connection.commit()
                user = (user_id, username, email, password_hash)
        
        cursor.close()
        connection.close()
        
        if user and check_password_hash(user[3], password):
            # Login successful
            session['user_id'] = user[0]
            session['username'] = user[1]
            session['email'] = user[2]
            
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'user': {'id': user[0], 'username': user[1], 'email': user[2]}
            }), 200
        else:
            return jsonify({'error': 'Invalid email or password'}), 401
            
    except Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
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
                'username': session['username'],
                'email': session.get('email', '')
            }
        })
    else:
        return jsonify({'logged_in': False})

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Handle PDF file upload with enhanced file management"""
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
            file_size_mb = f"{round(file_size / (1024*1024), 2)} MB"
            
            # Connect to database
            connection = get_db_connection()
            if connection is None:
                return jsonify({'error': 'Database connection failed'}), 500
            
            cursor = connection.cursor()
            
            # Ensure files table exists before inserting
            cursor.execute("SHOW TABLES LIKE 'files'")
            files_table_exists = cursor.fetchone() is not None
            
            if not files_table_exists:
                print("🔧 Files table missing, creating it...")
                ensure_table_exists('files')
            
            # Save to enhanced files table
            try:
                cursor.execute(
                    '''INSERT INTO files (user_id, file_id, original_filename, stored_filename, 
                       file_size, file_size_display, last_read) VALUES (%s, %s, %s, %s, %s, %s, %s)''',
                    (session['user_id'], file_id, original_filename, stored_filename, 
                     file_size, file_size_mb, datetime.now().date())
                )
                print("✅ File saved to files table")
            except Error as e:
                print(f"⚠️  Warning: Could not save to files table: {e}")
            
            # Ensure book table exists before inserting
            cursor.execute("SHOW TABLES LIKE 'book'")
            book_table_exists = cursor.fetchone() is not None
            
            if not book_table_exists:
                print("🔧 Book table missing, creating it...")
                ensure_table_exists('book')
            
            # Also save to book table for backward compatibility
            try:
                cursor.execute(
                    'INSERT INTO book (username, book_title, size, last_read) VALUES (%s, %s, %s, %s)',
                    (session.get('email', session['username']), original_filename, file_size_mb, datetime.now().date())
                )
                print("✅ File saved to book table")
            except Error as e:
                print(f"⚠️  Warning: Could not save to book table: {e}")
            
            connection.commit()
            cursor.close()
            connection.close()
            
            return jsonify({
                'success': True,
                'message': 'File uploaded successfully',
                'file_id': file_id,
                'original_filename': original_filename,
                'filename': stored_filename,
                'file_size': file_size,
                'file_size_mb': file_size_mb,
                'filepath': filepath
            }), 200
            
    except Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500
@app.route('/files')
@login_required
def list_files():
    """List all uploaded PDF files for the current user with enhanced information"""
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        file_list = []
        
        # Check if files table exists
        cursor.execute("SHOW TABLES LIKE 'files'")
        files_table_exists = cursor.fetchone() is not None
        
        if files_table_exists:
            # Try to get files from enhanced files table first
            try:
                cursor.execute(
                    '''SELECT file_id, original_filename, stored_filename, file_size, 
                       file_size_display, upload_date, last_read 
                       FROM files WHERE user_id = %s ORDER BY upload_date DESC''',
                    (session['user_id'],)
                )
                files = cursor.fetchall()
                
                print(f"Found {len(files)} files for user {session['user_id']}")  # Debug
                
                if files:
                    # Files from enhanced table
                    for file in files:
                        file_data = {
                            'file_id': file[0],
                            'filename': file[1],  # This should match JavaScript expectation
                            'stored_filename': file[2],
                            'size': file[3],
                            'size_display': file[4],
                            'size_mb': round(file[3] / (1024*1024), 2) if file[3] else 0,
                            'upload_date': file[5].strftime('%Y-%m-%d') if file[5] else None,
                            'last_read': file[6].strftime('%Y-%m-%d') if file[6] else None
                        }
                        file_list.append(file_data)
                        print(f"Added file: {file_data['filename']}")  # Debug
                        
            except Error as e:
                print(f"Warning: Could not read from files table: {e}")
        
        # If no files found in files table or table doesn't exist, check book table
        if not file_list:
            print("No files in files table, checking book table...")
            # Check book table
            cursor.execute("SHOW TABLES LIKE 'book'")
            book_table_exists = cursor.fetchone() is not None
            if book_table_exists:
                cursor.execute(
                    'SELECT book_title, size, last_read, created_at FROM book WHERE username = %s ORDER BY last_read DESC',
                    (session.get('email', session['username']),)
                )
                books = cursor.fetchall()
                for book in books:
                    file_data = {
                        'file_id': book,                # book_title
                        'filename': book,               # book_title
                        'stored_filename': book,        # Just for frontend expectations; not the actual file path
                        'size': None,                      # Could use book[1] if stored as bytes
                        'size_display': book[1],           # string like "2.35 MB"
                        'upload_date': str(book) if book else None,   # created_at
                        'last_read': str(book[2]) if book[2] else None      # last_read
                    }
                    file_list.append(file_data)

        
        cursor.close()
        connection.close()
        
        print(f"Returning {len(file_list)} files")  # Debug
        return jsonify({'files': file_list})
        
    except Error as e:
        print(f"Database error in list_files: {e}")  # Debug
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        print(f"General error in list_files: {e}")  # Debug
        return jsonify({'error': f'Failed to list files: {str(e)}'}), 500
@app.route('/debug-user-files')
@login_required
def debug_user_files():
    """Debug endpoint to check user files and session data"""
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        debug_info = {
            'session_data': {
                'user_id': session.get('user_id'),
                'username': session.get('username'),
                'email': session.get('email')
            },
            'tables': {}
        }
        
        # Check files table
        try:
            cursor.execute("SHOW TABLES LIKE 'files'")
            files_table_exists = cursor.fetchone() is not None
            debug_info['tables']['files_exists'] = files_table_exists
            
            if files_table_exists:
                # Get all files for this user
                cursor.execute(
                    'SELECT file_id, original_filename, user_id FROM files WHERE user_id = %s',
                    (session['user_id'],)
                )
                files = cursor.fetchall()
                debug_info['tables']['files_data'] = [
                    {'file_id': f[0], 'filename': f[1], 'user_id': f[2]} for f in files
                ]
                
                # Get total files count
                cursor.execute('SELECT COUNT(*) FROM files')
                total_files = cursor.fetchone()[0]
                debug_info['tables']['total_files_in_db'] = total_files
                
        except Error as e:
            debug_info['tables']['files_error'] = str(e)
        
        # Check book table
        try:
            cursor.execute("SHOW TABLES LIKE 'book'")
            book_table_exists = cursor.fetchone() is not None
            debug_info['tables']['book_exists'] = book_table_exists
            
            if book_table_exists:
                # Get all books for this user
                cursor.execute(
                    'SELECT book_title, username FROM book WHERE username = %s',
                    (session.get('email', session['username']),)
                )
                books = cursor.fetchall()
                debug_info['tables']['book_data'] = [
                    {'title': b[0], 'username': b[1]} for b in books
                ]
                
                # Get total books count
                cursor.execute('SELECT COUNT(*) FROM book')
                total_books = cursor.fetchone()[0]
                debug_info['tables']['total_books_in_db'] = total_books
                
        except Error as e:
            debug_info['tables']['book_error'] = str(e)
        
        cursor.close()
        connection.close()
        
        return jsonify(debug_info)
        
    except Exception as e:
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500

@app.route('/delete-file/<file_identifier>', methods=['DELETE'])
@login_required
def delete_file(file_identifier):
    """Delete a file - supports both file_id and book_title for backward compatibility"""
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        deleted = False
        physical_file_path = None
        
        # Check if files table exists
        cursor.execute("SHOW TABLES LIKE 'files'")
        files_table_exists = cursor.fetchone() is not None
        
        if files_table_exists:
            # Try to delete from files table first (by file_id)
            try:
                cursor.execute(
                    'SELECT stored_filename FROM files WHERE file_id = %s AND user_id = %s',
                    (file_identifier, session['user_id'])
                )
                file_info = cursor.fetchone()
                
                if file_info:
                    # Delete from files table
                    cursor.execute(
                        'DELETE FROM files WHERE file_id = %s AND user_id = %s',
                        (file_identifier, session['user_id'])
                    )
                    physical_file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info[0])
                    deleted = True
            except Error as e:
                print(f"⚠️  Warning: Could not delete from files table: {e}")
        
        # If not deleted from files table, try book table
        if not deleted:
            # Check if book table exists
            cursor.execute("SHOW TABLES LIKE 'book'")
            book_table_exists = cursor.fetchone() is not None
            
            if not book_table_exists:
                print("🔧 Book table missing, creating it...")
                ensure_table_exists('book')
            
            # Fallback to book table (by book_title for backward compatibility)
            try:
                cursor.execute(
                    'DELETE FROM book WHERE book_title = %s AND username = %s',
                    (file_identifier, session.get('email', session['username']))
                )
                if cursor.rowcount > 0:
                    deleted = True
            except Error as e:
                print(f"⚠️  Warning: Could not delete from book table: {e}")
        
        if not deleted:
            cursor.close()
            connection.close()
            return jsonify({'error': 'File not found or access denied'}), 404
        
        connection.commit()
        cursor.close()
        connection.close()
        
        # Delete physical file if path is available
        if physical_file_path and os.path.exists(physical_file_path):
            try:
                os.remove(physical_file_path)
                print(f"✅ Physical file deleted: {physical_file_path}")
            except Exception as e:
                print(f"⚠️  Warning: Could not delete physical file: {e}")
        
        return jsonify({'success': True, 'message': 'File deleted successfully'}), 200
        
    except Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500

@app.route('/test-db')
def test_database():
    """Enhanced test endpoint to check database connection and show all tables (for web requests)"""
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        result = {
            'success': True,
            'message': 'Database connected successfully',
            'tables': {}
        }
        
        # Check users table
        try:
            cursor.execute("SELECT id, username, email, created_at FROM users")
            users = cursor.fetchall()
            result['tables']['users'] = {
                'count': len(users),
                'records': [{'id': user[0], 'username': user[1], 'email': user[2], 'created_at': str(user[3])} for user in users]
            }
        except Error:
            result['tables']['users'] = {'count': 0, 'records': [], 'error': 'Table not found or inaccessible'}
        
        # Check old user table
        try:
            cursor.execute("SELECT username FROM user")
            old_users = cursor.fetchall()
            result['tables']['user'] = {
                'count': len(old_users),
                'records': [{'username': user[0]} for user in old_users]
            }
        except Error:
            result['tables']['user'] = {'count': 0, 'records': [], 'error': 'Table not found'}
        
        # Check files table
        try:
            cursor.execute("SELECT user_id, file_id, original_filename, file_size_display, upload_date FROM files")
            files = cursor.fetchall()
            result['tables']['files'] = {
                'count': len(files),
                'records': [{'user_id': f[0], 'file_id': f[1], 'filename': f[2], 'size': f[3], 'upload_date': str(f[4])} for f in files]
            }
        except Error:
            result['tables']['files'] = {'count': 0, 'records': [], 'error': 'Table not found'}
        
        # Check book table
        try:
            cursor.execute("SELECT username, book_title, size, last_read FROM book")
            books = cursor.fetchall()
            result['tables']['book'] = {
                'count': len(books),
                'records': [{'username': b[0], 'title': b[1], 'size': b[2], 'last_read': str(b[3])} for b in books]
            }
        except Error:
            result['tables']['book'] = {'count': 0, 'records': [], 'error': 'Table not found'}
        
        cursor.close()
        connection.close()
        
        return jsonify(result)
        
    except Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 100MB'}), 413

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

# Add these routes to your Flask app

@app.route('/book/<file_id>')
@login_required
def view_book(file_id):
    """Serve the book reader page with PDF data"""
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Get file information
        cursor.execute(
            '''SELECT original_filename, stored_filename FROM files 
               WHERE file_id = %s AND user_id = %s''',
            (file_id, session['user_id'])
        )
        file_info = cursor.fetchone()
        
        if not file_info:
            cursor.close()
            connection.close()
            return "File not found", 404
        
        cursor.close()
        connection.close()
        
        # Pass file info to template
        return render_template('book.html', 
                             file_id=file_id,
                             filename=file_info[0],
                             stored_filename=file_info[1])
        
    except Exception as e:
        return f"Error loading book: {str(e)}", 500

@app.route('/api/book/<file_id>/pages')
@login_required
def get_book_pages(file_id):
    """Get total pages count for a PDF"""
    try:
          # You'll need: pip install PyMuPDF
        
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Get stored filename
        cursor.execute(
            '''SELECT stored_filename FROM files 
               WHERE file_id = %s AND user_id = %s''',
            (file_id, session['user_id'])
        )
        file_info = cursor.fetchone()
        
        if not file_info:
            return jsonify({'error': 'File not found'}), 404
        
        cursor.close()
        connection.close()
        
        # Open PDF and get page count
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info[0])
        if not os.path.exists(pdf_path):
            return jsonify({'error': 'PDF file not found on disk'}), 404
        
        pdf_doc = fitz.open(pdf_path)
        total_pages = pdf_doc.page_count
        pdf_doc.close()
        
        return jsonify({
            'success': True,
            'total_pages': total_pages,
            'file_id': file_id
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get page count: {str(e)}'}), 500

@app.route('/api/book/<file_id>/page/<int:page_num>')
@login_required
def get_book_page(file_id, page_num):
    """Get a specific page as base64 image"""
    try:
        import fitz
        import base64
        
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Get stored filename
        cursor.execute(
            '''SELECT stored_filename FROM files 
               WHERE file_id = %s AND user_id = %s''',
            (file_id, session['user_id'])
        )
        file_info = cursor.fetchone()
        
        if not file_info:
            return jsonify({'error': 'File not found'}), 404
        
        cursor.close()
        connection.close()
        
        # Open PDF and get page
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info[0])
        if not os.path.exists(pdf_path):
            return jsonify({'error': 'PDF file not found on disk'}), 404
        
        pdf_doc = fitz.open(pdf_path)
        
        # Validate page number
        if page_num < 1 or page_num > pdf_doc.page_count:
            pdf_doc.close()
            return jsonify({'error': 'Invalid page number'}), 400
        
        # Get page (0-indexed)
        page = pdf_doc.load_page(page_num - 1)
        
        # Render page to image (higher quality)
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("png")
        
        # Convert to base64
        img_base64 = base64.b64encode(img_data).decode()
        
        pdf_doc.close()
        
        return jsonify({
            'success': True,
            'page_num': page_num,
            'image': f"data:image/png;base64,{img_base64}",
            'total_pages': pdf_doc.page_count
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get page: {str(e)}'}), 500

# Add this to handle file selection from library
@app.route('/select-file/<file_id>', methods=['POST'])
@login_required
def select_file(file_id):
    """Handle file selection from library - returns redirect info"""
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Verify file exists and belongs to user
        cursor.execute(
            '''SELECT original_filename FROM files 
               WHERE file_id = %s AND user_id = %s''',
            (file_id, session['user_id'])
        )
        file_info = cursor.fetchone()
        
        if not file_info:
            return jsonify({'error': 'File not found'}), 404
        
        # Update last_read timestamp
        cursor.execute(
            'UPDATE files SET last_read = %s WHERE file_id = %s',
            (datetime.now().date(), file_id)
        )
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'redirect_url': f'/book/{file_id}',
            'filename': file_info[0]
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to select file: {str(e)}'}), 500
@app.route('/test-book')
def test_book():
    return "Book route is working!"

# Add these classes to your Flask app.py file

class PDFPageNode:
    """Node for linked list representing a PDF page"""
    def __init__(self, page_number, page_data=None):
        self.page_number = page_number
        self.page_data = page_data  # Base64 image data
        self.next = None
        self.prev = None
        self.is_loaded = False

class PDFLinkedList:
    """Doubly linked list for managing PDF pages"""
    def __init__(self, total_pages):
        self.head = None
        self.tail = None
        self.current = None
        self.total_pages = total_pages
        self.page_nodes = {}  # Dictionary for O(1) page access
        self._initialize_list()
    
    def _initialize_list(self):
        """Initialize the linked list with all page nodes"""
        for page_num in range(1, self.total_pages + 1):
            node = PDFPageNode(page_num)
            self.page_nodes[page_num] = node
            
            if self.head is None:
                self.head = node
                self.current = node
            else:
                self.tail.next = node
                node.prev = self.tail
            
            self.tail = node
    
    def get_page_node(self, page_number):
        """Get a specific page node"""
        return self.page_nodes.get(page_number)
    
    def load_page_data(self, page_number, page_data):
        """Load data for a specific page"""
        node = self.get_page_node(page_number)
        if node:
            node.page_data = page_data
            node.is_loaded = True
            return True
        return False
    
    def get_current_spread(self):
        """Get current two-page spread for book view"""
        if not self.current:
            return None, None
        
        left_page = self.current
        right_page = self.current.next if self.current.next else None
        
        return left_page, right_page
    
    def next_spread(self):
        """Move to next two-page spread"""
        if self.current and self.current.next:
            if self.current.next.next:  # Move by 2 pages
                self.current = self.current.next.next
            else:  # Last page
                self.current = self.current.next
            return True
        return False
    
    def prev_spread(self):
        """Move to previous two-page spread"""
        if self.current and self.current.prev:
            if self.current.prev.prev:  # Move by 2 pages
                self.current = self.current.prev.prev
            else:  # First page
                self.current = self.head
            return True
        return False
    
    def go_to_page(self, page_number):
        """Go to a specific page"""
        node = self.get_page_node(page_number)
        if node:
            self.current = node
            return True
        return False

# Global dictionary to store PDF linked lists for each user session
pdf_sessions = {}

def get_pdf_session_key(user_id, file_id):
    """Generate session key for PDF linked list"""
    return f"{user_id}_{file_id}"

# Modified Flask routes

@app.route('/api/book/<file_id>/initialize')
@login_required
def initialize_pdf_linkedlist(file_id):
    """Initialize PDF with linked list structure"""
    try:
        import fitz
        
        connection = get_db_connection()
        if connection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Get stored filename
        cursor.execute(
            '''SELECT stored_filename FROM files 
               WHERE file_id = %s AND user_id = %s''',
            (file_id, session['user_id'])
        )
        file_info = cursor.fetchone()
        
        if not file_info:
            return jsonify({'error': 'File not found'}), 404
        
        cursor.close()
        connection.close()
        
        # Open PDF and get page count
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info[0])
        if not os.path.exists(pdf_path):
            return jsonify({'error': 'PDF file not found on disk'}), 404
        
        pdf_doc = fitz.open(pdf_path)
        total_pages = pdf_doc.page_count
        pdf_doc.close()
        
        # Create linked list for this PDF session
        session_key = get_pdf_session_key(session['user_id'], file_id)
        pdf_sessions[session_key] = PDFLinkedList(total_pages)
        
        return jsonify({
            'success': True,
            'total_pages': total_pages,
            'file_id': file_id,
            'session_key': session_key
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to initialize PDF: {str(e)}'}), 500

@app.route('/api/book/<file_id>/current-spread')
@login_required
def get_current_spread(file_id):
    """Get current two-page spread using linked list"""
    try:
        session_key = get_pdf_session_key(session['user_id'], file_id)
        pdf_list = pdf_sessions.get(session_key)
        
        if not pdf_list:
            return jsonify({'error': 'PDF session not found. Please refresh the page.'}), 404
        
        left_page, right_page = pdf_list.get_current_spread()
        
        # Load page data if not already loaded
        result = {
            'success': True,
            'left_page': None,
            'right_page': None,
            'current_page_num': left_page.page_number if left_page else 1,
            'total_pages': pdf_list.total_pages
        }
        
        if left_page:
            if not left_page.is_loaded:
                # Remove 'await' and call synchronously
                left_page.page_data = load_page_from_pdf(file_id, left_page.page_number)
                left_page.is_loaded = True
            
            result['left_page'] = {
                'page_number': left_page.page_number,
                'image_data': left_page.page_data
            }
        
        if right_page:
            if not right_page.is_loaded:
                # Remove 'await' and call synchronously
                right_page.page_data = load_page_from_pdf(file_id, right_page.page_number)
                right_page.is_loaded = True
            
            result['right_page'] = {
                'page_number': right_page.page_number,
                'image_data': right_page.page_data
            }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Failed to get current spread: {str(e)}'}), 500

@app.route('/api/book/<file_id>/navigate/<direction>')
@login_required
def navigate_pdf(file_id, direction):
    """Navigate PDF using linked list (next/prev)"""
    try:
        session_key = get_pdf_session_key(session['user_id'], file_id)
        pdf_list = pdf_sessions.get(session_key)
        
        if not pdf_list:
            return jsonify({'error': 'PDF session not found. Please refresh the page.'}), 404
        
        success = False
        if direction == 'next':
            success = pdf_list.next_spread()
        elif direction == 'prev':
            success = pdf_list.prev_spread()
        
        if not success:
            return jsonify({'error': f'Cannot navigate {direction}'}), 400
        
        # Return current spread after navigation
        return get_current_spread(file_id)
        
    except Exception as e:
        return jsonify({'error': f'Failed to navigate: {str(e)}'}), 500

@app.route('/api/book/<file_id>/goto/<int:page_number>')
@login_required
def goto_page(file_id, page_number):
    """Go to a specific page using linked list"""
    try:
        session_key = get_pdf_session_key(session['user_id'], file_id)
        pdf_list = pdf_sessions.get(session_key)
        
        if not pdf_list:
            return jsonify({'error': 'PDF session not found. Please refresh the page.'}), 404
        
        if not pdf_list.go_to_page(page_number):
            return jsonify({'error': 'Invalid page number'}), 400
        
        # Return current spread after navigation
        return get_current_spread(file_id)
        
    except Exception as e:
        return jsonify({'error': f'Failed to go to page: {str(e)}'}), 500

def load_page_from_pdf(file_id, page_num):
    """Helper function to load page data from PDF file"""
    try:
        import fitz
        import base64
        
        connection = get_db_connection()
        if connection is None:
            return None
        
        cursor = connection.cursor()
        
        # Get stored filename
        cursor.execute(
            '''SELECT stored_filename FROM files 
               WHERE file_id = %s AND user_id = %s''',
            (file_id, session['user_id'])
        )
        file_info = cursor.fetchone()
        
        if not file_info:
            return None
        
        cursor.close()
        connection.close()
        
        # Open PDF and get page
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info[0])
        if not os.path.exists(pdf_path):
            return None
        
        pdf_doc = fitz.open(pdf_path)
        
        # Validate page number
        if page_num < 1 or page_num > pdf_doc.page_count:
            pdf_doc.close()
            return None
        
        # Get page (0-indexed)
        page = pdf_doc.load_page(page_num - 1)
        
        # Render page to image (higher quality)
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("png")
        
        # Convert to base64
        img_base64 = f"data:image/png;base64,{base64.b64encode(img_data).decode()}"
        
        pdf_doc.close()
        
        return img_base64
        
    except Exception as e:
        print(f"Error loading page {page_num}: {e}")    
        return None
    
# Cleanup function to remove old PDF sessions
@app.route('/api/book/<file_id>/cleanup')
@login_required
def cleanup_pdf_session(file_id):
    """Clean up PDF session when user leaves"""
    try:
        session_key = get_pdf_session_key(session['user_id'], file_id)
        if session_key in pdf_sessions:
            del pdf_sessions[session_key]
        
        return jsonify({'success': True, 'message': 'Session cleaned up'})
        
    except Exception as e:
        return jsonify({'error': f'Cleanup failed: {str(e)}'}), 500
    
if __name__ == '__main__':
    # Initialize database and test connection on startup
    print("🔄 Initializing database...")
    if init_db():
        print("🔄 Testing database connection...")
        if test_database_connection():  # Use the non-Flask function for startup
            print("🔄 Running migration check...")
            migrate_user_table()
            print("✅ Ready to start Flask server!")
        else:
            print("❌ Database connection failed. Please check your configuration.")
            print("Update the DB_CONFIG dictionary with your MySQL credentials.")
    else:
        print("❌ Database initialization failed.")
    
    # Create upload folder on startup
    create_upload_folder()
    print(f"Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print("Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=5000)
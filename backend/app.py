from flask import Flask
from flask_cors import CORS
from models import db
from config import Config
from routes import main

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enhanced CORS configuration
    CORS(app, resources={
        r"/api/*": {  # Note: Changed to match your blueprint prefix
            "origins": "*",  # Allow all origins for development
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    })

    db.init_app(app)
    app.register_blueprint(main)

    # Add the root route inside create_app()
    @app.route('/')
    def home():
        return """
        <h1>Invoice API</h1>
        <p>Available endpoints:</p>
        <ul>
            <li><a href="/api/factures">/api/factures</a> - List invoices</li>
            <li>/api/factures/[id] - View specific invoice</li>
        </ul>
        """

    with app.app_context():
        db.create_all()

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
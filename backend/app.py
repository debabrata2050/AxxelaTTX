import os
from flask import Flask, jsonify
from flask_cors import CORS

from api import file_bp, trade_bp, export_bp


def create_app() -> Flask:
    """
    Application Factory for Trade Transfer Backend.
    Provides REST API endpoints for Next.js frontend.
    """
    app = Flask(__name__)
    
    # Enable CORS for Next.js dev server and local clients
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Allow large institutional CSV uploads up to 500MB
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024

    # Register modular blueprints
    app.register_blueprint(file_bp)
    app.register_blueprint(trade_bp)
    app.register_blueprint(export_bp)

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "healthy", "service": "Trade Transfer Backend"})

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

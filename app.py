import os
from flask import Flask, send_from_directory

from api import file_bp, trade_bp, export_bp

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")


def create_app() -> Flask:
    """
    Application Factory (S.O.L.I.D).
    Decouples configuration and blueprint registration from execution.
    """
    app = Flask(__name__, static_folder=STATIC_DIR)

    # Register modular blueprints
    app.register_blueprint(file_bp)
    app.register_blueprint(trade_bp)
    app.register_blueprint(export_bp)

    @app.route("/")
    def index():
        return send_from_directory(STATIC_DIR, "index.html")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

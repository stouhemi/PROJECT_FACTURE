from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Facture(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date_facturation = db.Column(db.Date, nullable=False)
    numero_facture = db.Column(db.String(50), unique=True, nullable=False)
    nom_client = db.Column(db.String(100), nullable=False)
    nom_societe = db.Column(db.String(100))
    adresse = db.Column(db.String(200))
    timbre = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(10), default="impayé")

    lines = db.relationship('FactureLine', backref='facture', cascade='all, delete-orphan')
    documents = db.relationship('Document', backref='facture', cascade='all, delete-orphan')

class FactureLine(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    designation = db.Column(db.String(10))
    description = db.Column(db.Text)
    quantite = db.Column(db.Integer)
    prix_unitaire = db.Column(db.Float)
    facture_id = db.Column(db.Integer, db.ForeignKey('facture.id'), nullable=False)

class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_name = db.Column(db.String(255))
    facture_id = db.Column(db.Integer, db.ForeignKey('facture.id'), nullable=False)

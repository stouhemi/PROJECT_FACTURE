import os
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from datetime import datetime
from models import db, Facture, FactureLine, Document
from config import Config
import json
from flask import current_app
from xhtml2pdf import pisa
from flask import render_template, make_response
import io
from flask import make_response
#from flask import render_template
import pdfkit








#main = Blueprint('main', __name__)
main = Blueprint('main', __name__, url_prefix='/api')

@main.route('/factures', methods=['POST'])
def create_facture():
    try:
        data = request.form
        lines_data = request.json.get('lines') if request.is_json else eval(data.get('lines'))

        facture = Facture(
            date_facturation=datetime.strptime(data['date_facturation'], "%Y-%m-%d").date(),
            numero_facture=data['numero_facture'],
            nom_client=data['nom_client'],
            nom_societe=data.get('nom_societe'),
            adresse=data.get('adresse'),
            timbre=float(data.get('timbre', 0.0)),
            status=data.get('status', 'impayé')
        )

        total_services = 0.0
        total_frais = 0.0
        total_tva = 0.0

        for line in lines_data:
            designation = line['designation']
            prix_unitaire = float(line['prix_unitaire'])
            quantite = int(line['quantite'])
            tva = 0.0 if designation == 'Frais' else prix_unitaire * 0.19
            total_ht = prix_unitaire * quantite

            if designation == 'Frais':
                total_frais += total_ht
            else:
                total_services += total_ht
                total_tva += tva * quantite

            new_line = FactureLine(
                designation=designation,
                description=line.get('description'),
                prix_unitaire=prix_unitaire,
                quantite=quantite,
                facture=facture
            )
            db.session.add(new_line)

        total_ttc = total_services + total_tva
        ras = total_ttc * 0.03
        net_a_payer = (total_ttc + total_frais + facture.timbre) - ras

        db.session.add(facture)
        db.session.flush()  # Ensure facture.id exists for document upload

        # Handle documents
        if 'documents' in request.files:
            files = request.files.getlist('documents')
            for file in files:
                if file.filename:
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(Config.UPLOAD_FOLDER, filename)
                    file.save(file_path)

                    doc = Document(file_name=filename, facture_id=facture.id)
                    db.session.add(doc)

        db.session.commit()

        return jsonify({
            'message': 'Facture créée avec succès',
            'facture_id': facture.id,
            'totals': {
                'total_services': total_services,
                'total_tva': total_tva,
                'total_ttc': total_ttc,
                'frais': total_frais,
                'ras': ras,
                'net_a_payer': net_a_payer
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

#View and Search Factures
from sqlalchemy import or_

@main.route('/factures', methods=['GET'])
def get_factures():
    try:
        query = Facture.query

        # Optional filters
        date = request.args.get('date_facturation')
        nom_client = request.args.get('nom_client')
        nom_societe = request.args.get('nom_societe')
        adresse = request.args.get('adresse')
        status = request.args.get('status')

        if date:
            query = query.filter(Facture.date_facturation == date)
        if nom_client:
            query = query.filter(Facture.nom_client.ilike(f"%{nom_client}%"))
        if nom_societe:
            query = query.filter(Facture.nom_societe.ilike(f"%{nom_societe}%"))
        if adresse:
            query = query.filter(Facture.adresse.ilike(f"%{adresse}%"))
        if status:
            query = query.filter(Facture.status == status)

        factures = query.all()

        result = []
        for f in factures:
            lines = []
            for line in f.lines:
                lines.append({
                    'designation': line.designation,
                    'description': line.description,
                    'prix_unitaire': line.prix_unitaire,
                    'quantite': line.quantite,
                    'total_ht': line.prix_unitaire * line.quantite,
                    'tva': 0 if line.designation == 'Frais' else line.prix_unitaire * 0.19
                })

            total_services = sum(l['total_ht'] for l in lines if l['designation'] == 'Service')
            total_frais = sum(l['total_ht'] for l in lines if l['designation'] == 'Frais')
            total_tva = sum(l['tva'] * l['quantite'] for l in lines if l['designation'] == 'Service')
            total_ttc = total_services + total_tva
            ras = total_ttc * 0.03
            net_a_payer = (total_ttc + total_frais + f.timbre) - ras

            result.append({
                'id': f.id,
                'date_facturation': f.date_facturation.strftime("%Y-%m-%d"),
                'numero_facture': f.numero_facture,
                'nom_client': f.nom_client,
                'nom_societe': f.nom_societe,
                'adresse': f.adresse,
                'status': f.status,
                'lines': lines,
                'summary': {
                    'total_services': total_services,
                    'total_frais': total_frais,
                    'total_tva': total_tva,
                    'total_ttc': total_ttc,
                    'ras': ras,
                    'timbre': f.timbre,
                    'net_a_payer': net_a_payer
                }
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 400
    

#View a Specific Facture


@main.route('/factures/<int:facture_id>', methods=['GET'])
def get_facture(facture_id):
    try:
        print(f"Attempting to fetch invoice {facture_id}")  # Debug log
        facture = Facture.query.get(facture_id)
        if not facture:
            print(f"Invoice {facture_id} not found")  # Debug log
            return jsonify({'error': 'Invoice not found'}), 404

        lines = []
        for line in facture.lines:
            tva = 0 if line.designation == 'Frais' else line.prix_unitaire * 0.19
            total_ht = line.prix_unitaire * line.quantite

            lines.append({
                'designation': line.designation,
                'description': line.description,
                'prix_unitaire': line.prix_unitaire,
                'quantite': line.quantite,
                'total_ht': total_ht,
                'tva': tva
            })

        total_services = sum(l['total_ht'] for l in lines if l['designation'] == 'Service')
        total_frais = sum(l['total_ht'] for l in lines if l['designation'] == 'Frais')
        total_tva = sum(l['tva'] * l['quantite'] for l in lines if l['designation'] == 'Service')
        total_ttc = total_services + total_tva
        ras = total_ttc * 0.03
        net_a_payer = (total_ttc + total_frais + facture.timbre) - ras

        # Include documents
        documents = []
        for doc in facture.documents:
            documents.append({
                'id': doc.id,
                'name': doc.file_name,
                'view_url': f"/documents/{doc.id}",
                'download_url': f"/documents/{doc.id}/download"
            })

        result = {
            'id': facture.id,
            'date_facturation': facture.date_facturation.strftime('%Y-%m-%d'),
            'numero_facture': facture.numero_facture,
            'nom_client': facture.nom_client,
            'nom_societe': facture.nom_societe,
            'adresse': facture.adresse,
            'status': facture.status,
            'timbre': facture.timbre,
            'lines': lines,
            'summary': {
                'total_services': total_services,
                'total_frais': total_frais,
                'total_tva': total_tva,
                'total_ttc': total_ttc,
                'ras': ras,
                'net_a_payer': net_a_payer
            },
            'documents': documents  # ✅ Added documents info
        }

        response = jsonify(result)
        response.headers['Content-Type'] = 'application/json'
        print(f"Successfully returned invoice {facture_id}")  # Debug log
        return response
    except Exception as e:
        print(f"Error fetching invoice {facture_id}: {str(e)}")  # Debug log
        #current_app.logger.error(f"Error fetching invoice {facture_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500


#Modify a Facture

@main.route('/factures/<int:facture_id>', methods=['PUT'])
def update_facture(facture_id):
    facture = Facture.query.get_or_404(facture_id)
    data = request.form

    facture.date_facturation = datetime.strptime(data.get('date_facturation'), '%Y-%m-%d')
    facture.numero_facture = data.get('numero_facture')
    facture.nom_client = data.get('nom_client')
    facture.nom_societe = data.get('nom_societe')
    facture.adresse = data.get('adresse')
    facture.status = data.get('status')
    facture.timbre = float(data.get('timbre'))

    # Remove old lines
    FactureLine.query.filter_by(facture_id=facture.id).delete()

    # Add new lines
    lines = json.loads(data.get('lines', '[]'))
    for line_data in lines:
        line = FactureLine(
            facture_id=facture.id,
            designation=line_data['designation'],
            description=line_data['description'],
            prix_unitaire=line_data['prix_unitaire'],
            quantite=line_data['quantite']
        )
        db.session.add(line)

    # Handle new document
    if 'document' in request.files:
        file = request.files['document']
        if file.filename:
            filename = secure_filename(file.filename)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            facture.document_filename = filename

    db.session.commit()
    return jsonify({'message': 'Facture updated successfully'}), 200


#Delete a facture

import os
from flask import current_app

@main.route('/factures/<int:id>', methods=['DELETE'])
def delete_facture(id):
    facture = Facture.query.get(id)
    if not facture:
        return jsonify({'error': 'Facture not found'}), 404

    # Delete associated documents (files on disk)
    for doc in facture.documents:
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], doc.file_name)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")

    db.session.delete(facture)
    db.session.commit()

    return jsonify({'message': 'Facture and associated documents deleted successfully'})



#Display/Download Documents Related to a Facture
# GET /documents/<int:id> → View the document (open in browser).
#GET /documents/<int:id>/download → Download the document.
from flask import send_from_directory

# View document in browser (or new tab)

@main.route('/documents/<int:id>', methods=['GET'])
def view_document(id):
    document = Document.query.get_or_404(id)
    return send_from_directory(
        current_app.config['UPLOAD_FOLDER'],
        document.file_name,
        as_attachment=False
    )
# Download document
@main.route('/documents/<int:id>/download', methods=['GET'])
def download_document(id):
    document = Document.query.get_or_404(id)
    return send_from_directory(
        current_app.config['UPLOAD_FOLDER'],
        document.file_name,
        as_attachment=True
    )




from flask import render_template, make_response
import pdfkit

@main.route('/factures/<int:facture_id>/download', methods=['GET'])
def download_facture_pdf(facture_id):
    try:
        # Fetch invoice data from database
        facture = Facture.query.get_or_404(facture_id)
        
        # Calculate all necessary values
        lines = []
        for line in facture.lines:
            tva = 0.0 if line.designation == 'Frais' else line.prix_unitaire * 0.19
            total_ht = line.prix_unitaire * line.quantite
            
            lines.append({
                'designation': line.designation,
                'description': line.description,
                'unit_price': line.prix_unitaire,
                'quantity': line.quantite,
                'total': total_ht,
                'vat': tva
            })

        total_services = sum(l['total'] for l in lines if l['designation'] == 'Service')
        total_frais = sum(l['total'] for l in lines if l['designation'] == 'Frais')
        total_vat = sum(l['vat'] * l['quantity'] for l in lines if l['designation'] == 'Service')
        total_ttc = total_services + total_vat
        ras_percentage = 3  # Default RAS percentage
        ras = total_ttc * (ras_percentage / 100)
        net_to_pay = (total_ttc + total_frais + facture.timbre) - ras

        # Prepare context for template
        context = {
            'invoice_number': facture.numero_facture,
            'invoice_date': facture.date_facturation.strftime('%d/%m/%Y'),
            'company_name': "STE YASMINE SERVICES",  # Replace with your company info
            'company_address': "84, AV de la république- Hmmam-Lif",
            'company_phone': "29 972 425 / 28 988 228",
            'company_email': "salah.ferchichi.av",
            'mf':"1693027 W / A / M / 000",
            'client_name': facture.nom_client,
            'client_company': facture.nom_societe or "",
            'client_address': facture.adresse or "",
            'items': lines,
            'total_services': f"{total_services:.2f}",
            'total_vat': f"{total_vat:.2f}",
            'total_ttc': f"{total_ttc:.2f}",
            'fees': f"{total_frais:.2f}",
            'stamp': f"{facture.timbre:.2f}",
            'ras': f"{ras:.2f}",
            'ras_percentage': ras_percentage,
            'net_to_pay': f"{net_to_pay:.2f}"
        }

        # Render template
        rendered = render_template('invoice_template.html', **context)
        
        # Configure PDF options
        options = {
            'encoding': 'UTF-8',
            'quiet': '',
            'page-size': 'A4',
            'margin-top': '15mm',
            'margin-right': '15mm',
            'margin-bottom': '15mm',
            'margin-left': '15mm'
        }
        
        # Generate PDF
        pdf = pdfkit.from_string(rendered, False, options=options)
        
        if not pdf:
            raise Exception("Failed to generate PDF")

        # Create response
        response = make_response(pdf)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=facture_{facture.numero_facture}.pdf'
        return response

    except Exception as e:
        current_app.logger.error(f"Error generating PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500




@main.route('/')
def index_page():
    return render_template('index.html')

@main.route('/create')
def create_invoice_page():
    return render_template('create-invoice.html')

@main.route('/invoice/<int:id>')
def view_invoice_page(id):
    return render_template('view_invoice.html', facture_id=id)


import os

class Config:
    SQLALCHEMY_DATABASE_URI = 'mysql://Achref:Hondajaaz@localhost/invoice_db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    #UPLOAD_FOLDER = os.path.join(os.getcwd(), 'static', 'uploads')
    UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static', 'uploads'))
   
  

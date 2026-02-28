import React from 'react';
import { X, Phone, Mail, MapPin, MessageSquare, Building } from 'lucide-react';

interface ContactModalProps {
  contact: any;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ contact, onClose }) => {
  if (!contact) return null;

  const waNumber = contact.phone?.replace(/\D/g, '');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="font-bold text-white text-lg">Contact Profile</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold text-xl">
              {(contact.name || contact.contactName || '?')[0]}
            </div>
            <div>
              <p className="font-bold text-white text-lg">{contact.name || contact.contactName}</p>
              <p className="text-gray-400 text-sm">{contact.company || contact.companyName}</p>
            </div>
          </div>
          <div className="space-y-3">
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-300">{contact.phone}</span>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-300">{contact.email}</span>
              </div>
            )}
            {(contact.address || contact.streetAddress) && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-300">{contact.address || contact.streetAddress}</span>
              </div>
            )}
            {(contact.category || contact.natureCategory) && (
              <div className="flex items-center gap-3">
                <Building className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-300">{contact.category || contact.natureCategory}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <a href={`tel:${contact.phone}`} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              <Phone className="w-4 h-4" /> Call
            </a>
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;

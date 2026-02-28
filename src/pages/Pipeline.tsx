import React from 'react';
import { useApp } from '../context/AppContext';
import { MoreVertical, Plus, ChevronRight, DollarSign } from 'lucide-react';
import { DealStage } from '../data/types';

const Pipeline: React.FC = () => {
  const { state, updateDeal } = useApp();
  
  const stages: DealStage[] = [
    'New Lead', 'Consultation', 'Quote Sent', 'Design Review', 'In Production', 'Delivered'
  ];

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'New Lead': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Consultation': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'Quote Sent': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Design Review': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'In Production': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Deal Pipeline</h1>
          <p className="text-gray-400">Track and manage your branding projects</p>
        </div>
        <button className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </header>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 h-full min-w-max">
          {stages.map((stage) => {
            const deals = state.deals.filter(d => d.stage === stage);
            const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div key={stage} className="w-80 flex flex-col">
                <div className="flex justify-between items-center mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{stage}</h3>
                    <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{deals.length}</span>
                  </div>
                  <span className="text-amber-500 font-bold text-sm">${(totalValue / 1000).toFixed(1)}k</span>
                </div>

                <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-250px)]">
                  {deals.map((deal) => {
                    const contact = state.leads.find(l => l.id === deal.contactId);
                    return (
                      <div key={deal.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-sm hover:border-gray-700 transition-all cursor-move group">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-white group-hover:text-amber-500 transition-colors">{deal.name}</h4>
                          <button className="text-gray-500 hover:text-white"><MoreVertical className="w-4 h-4" /></button>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500">
                              {contact?.name?.[0] || 'U'}
                            </div>
                            {contact?.company}
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                            <div className="flex items-center text-amber-500 font-bold">
                              <DollarSign className="w-3.5 h-3.5" />
                              {deal.value.toLocaleString()}
                            </div>
                            <button 
                              onClick={() => {
                                const nextIndex = stages.indexOf(stage) + 1;
                                if (nextIndex < stages.length) {
                                  updateDeal(deal.id, { stage: stages[nextIndex] });
                                }
                              }}
                              className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-amber-500 transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {deals.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-gray-800 rounded-xl flex items-center justify-center text-gray-600 text-sm">
                      No deals here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Pipeline;

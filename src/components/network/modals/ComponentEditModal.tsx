import React from 'react';
import {
  NetworkBus,
  NetworkGenerator,
  NetworkLoad,
  NetworkShunt,
  NetworkTransformer,
  NetworkTransmissionLine,
  PowerFlowSolutionResult,
  PowerNetworkModel,
  SelectedNetworkElement,
} from '../../../types/network';
import { findNetworkEquipment } from '../../../model/networkModel';
import { BusEditDialog } from './BusEditDialog';
import { GeneratorEditDialog } from './GeneratorEditDialog';
import { LoadEditDialog } from './LoadEditDialog';
import { LineEditDialog } from './LineEditDialog';
import { TransformerEditDialog } from './TransformerEditDialog';
import { ShuntEditDialog } from './ShuntEditDialog';
import { X, Lock, Edit3 } from 'lucide-react';

interface ComponentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElement: SelectedNetworkElement | null;
  network: PowerNetworkModel;
  solution?: PowerFlowSolutionResult | null;
  isEditMode: boolean;
  onApplyBus: (busId: string, updates: Partial<NetworkBus>) => void;
  onApplyGenerator: (genId: string, updates: Partial<NetworkGenerator>) => void;
  onApplyLoad: (loadId: string, updates: Partial<NetworkLoad>) => void;
  onApplyLine: (lineId: string, updates: Partial<NetworkTransmissionLine>) => void;
  onApplyTransformer: (txId: string, updates: Partial<NetworkTransformer>) => void;
  onApplyShunt: (shuntId: string, updates: Partial<NetworkShunt>) => void;
}

export const ComponentEditModal: React.FC<ComponentEditModalProps> = ({
  isOpen,
  onClose,
  selectedElement,
  network,
  solution,
  isEditMode,
  onApplyBus,
  onApplyGenerator,
  onApplyLoad,
  onApplyLine,
  onApplyTransformer,
  onApplyShunt,
}) => {
  if (!isOpen || !selectedElement) return null;

  const found = findNetworkEquipment(network, selectedElement);
  if (!found || !found.item) return null;

  const titlePrefix =
    selectedElement.category === 'bus'
      ? 'Busbar Station'
      : selectedElement.category === 'generator'
      ? 'Generator Machine'
      : selectedElement.category === 'load'
      ? 'Power Demand'
      : selectedElement.category === 'line'
      ? 'Transmission Line'
      : selectedElement.category === 'transformer'
      ? 'Power Transformer'
      : 'Shunt Reactive Bank';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-lg ${
                isEditMode
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
              }`}
            >
              {isEditMode ? <Edit3 size={16} /> : <Lock size={16} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-600 dark:text-blue-300">
                  {titlePrefix}
                </span>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {selectedElement.id}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    isEditMode
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isEditMode ? 'Editing Mode' : 'Read-Only Inspection'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {found.item.name}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {selectedElement.category === 'bus' && (
            <BusEditDialog
              bus={found.item as NetworkBus}
              existingBuses={network.buses}
              isEditMode={isEditMode}
              onApply={(updates) => {
                onApplyBus(selectedElement.id, updates);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {selectedElement.category === 'generator' && (
            <GeneratorEditDialog
              generator={found.item as NetworkGenerator}
              buses={network.buses}
              solution={solution}
              isEditMode={isEditMode}
              onApply={(updates) => {
                onApplyGenerator(selectedElement.id, updates);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {selectedElement.category === 'load' && (
            <LoadEditDialog
              load={found.item as NetworkLoad}
              buses={network.buses}
              loadScaleFactor={network.loadScaleFactor}
              isEditMode={isEditMode}
              onApply={(updates) => {
                onApplyLoad(selectedElement.id, updates);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {selectedElement.category === 'line' && (
            <LineEditDialog
              line={found.item as NetworkTransmissionLine}
              buses={network.buses}
              solution={solution}
              isEditMode={isEditMode}
              onApply={(updates) => {
                onApplyLine(selectedElement.id, updates);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {selectedElement.category === 'transformer' && (
            <TransformerEditDialog
              transformer={found.item as NetworkTransformer}
              buses={network.buses}
              solution={solution}
              isEditMode={isEditMode}
              onApply={(updates) => {
                onApplyTransformer(selectedElement.id, updates);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {selectedElement.category === 'shunt' && (
            <ShuntEditDialog
              shunt={found.item as NetworkShunt}
              buses={network.buses}
              solution={solution}
              isEditMode={isEditMode}
              onApply={(updates) => {
                onApplyShunt(selectedElement.id, updates);
                onClose();
              }}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};

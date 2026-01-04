/* eslint-disable max-lines, max-lines-per-function, complexity, max-depth, @typescript-eslint/no-var-requires */
import React, { useState, useCallback, useEffect } from 'react';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import './TabTours.css';
import {
  createOverviewTourSteps,
  createAnalyticsTourSteps,
  createBatchTourSteps,
  createManageTourSteps,
  createSettingsTourSteps,
  createRBACTourSteps
} from './TabTours';
import { isGlobalEnabled, isTourEnabled } from './TourPrefs';

interface TabTourManagerProps {
  activeTab: string;
  userRole: 'admin' | 'employee';
}

// Track which tabs have been shown tours
const useTabTourTracking = () => {
  const getStorageKey = (tab: string) => `tabTour_${tab}_shown`;
  
  const hasShownTour = (tab: string) => {
    return localStorage.getItem(getStorageKey(tab)) === 'true';
  };

  const markTourShown = (tab: string) => {
    localStorage.setItem(getStorageKey(tab), 'true');
  };

  const resetTabTour = (tab: string) => {
    localStorage.removeItem(getStorageKey(tab));
  };

  const resetAllTours = () => {
    const tabs = ['overview', 'analytics', 'batch', 'manage', 'settings', 'rbac'];
    tabs.forEach(tab => resetTabTour(tab));
  };

  return { hasShownTour, markTourShown, resetTabTour, resetAllTours };
};

export function TabTourManager({ activeTab }: TabTourManagerProps) {
  const [currentTour, setCurrentTour] = useState<Shepherd.Tour | null>(null);
  const { hasShownTour, markTourShown, resetTabTour, resetAllTours } = useTabTourTracking();

  const createTourForTab = useCallback((tab: string, mode: 'follow' | 'guide' = 'guide') => {
    const tour = new Shepherd.Tour({
      useModalOverlay: mode === 'guide',
      defaultStepOptions: {
        scrollTo: { behavior: 'smooth', block: 'center' },
        cancelIcon: { enabled: true },
        classes: mode === 'follow' ? 'follow-mode' : undefined,
        canClickTarget: true,
        // Prefer not overlapping the target; allow library to flip/shift where possible
        // Using a permissive any-cast to support either Popper or Floating-UI under the hood
        ...( {
          popperOptions: {
            modifiers: [
              { name: 'offset', options: { offset: [0, 12] } },
              { name: 'flip', options: { fallbackPlacements: ['right', 'bottom', 'left', 'top'] } },
              { name: 'preventOverflow' }
            ]
          }
        } as any),
        when: {
          complete: () => markTourShown(tab),
          cancel: () => markTourShown(tab)
        }
      }
    });

  let steps: any[] = [];
    
    switch (tab) {
      case 'overview':
        steps = createOverviewTourSteps(tour);
        break;
      case 'analytics':
        steps = createAnalyticsTourSteps(tour, mode);
        break;
      case 'batch':
        steps = createBatchTourSteps(tour, mode);
        break;
      case 'manage':
        steps = createManageTourSteps(tour);
        break;
      case 'policies':
        // lazy import to avoid circular if needed
        try {
          const { createPoliciesTourSteps } = require('./TabTours');
          steps = createPoliciesTourSteps(tour);
        } catch {
          steps = [];
        }
        break;
      case 'settings':
        steps = createSettingsTourSteps(tour);
        break;
      case 'rbac':
        steps = createRBACTourSteps(tour);
        break;
      default:
        return null;
    }

    // Add a "Move" control to each step so users can relocate the tooltip if it covers the target
    const preferredOrder = ['right', 'bottom', 'left', 'top'];
    const moveCurrentStep = () => {
      try {
        const s: any = tour.getCurrentStep();
        if (!s || !s.options?.attachTo) return;
        const att = s.options.attachTo;
        const current = String(att.on || 'right').toLowerCase();
        const idx = Math.max(0, preferredOrder.indexOf(current));
        const next = preferredOrder[(idx + 1) % preferredOrder.length];
        // Update position and re-show
        if (typeof s.updateStepOptions === 'function') {
          s.updateStepOptions({ attachTo: { ...att, on: next } });
        } else {
          s.options.attachTo = { ...att, on: next };
        }
        // Briefly hide/show to force recompute
        s.hide();
        setTimeout(() => s.show(), 0);
      } catch { /* ignore */ }
    };

    // Push a Move button into each step's buttons (before the final button where possible)
    steps.forEach((step: any) => {
      if (!step.buttons || !Array.isArray(step.buttons)) {
        step.buttons = [];
      }
      const moveBtn = {
        text: 'Move',
        action: moveCurrentStep,
        classes: 'shepherd-button-secondary shepherd-button-move'
      };
      // Insert before the last button to keep Finish/Next at the end
      if (step.buttons.length >= 1) {
        step.buttons.splice(step.buttons.length - 1, 0, moveBtn);
      } else {
        step.buttons.push(moveBtn);
      }
    });

    steps.forEach(step => tour.addStep(step));

    // Follow-along mode: keep auto-closing stray modals on step transitions, but do not react to page clicks
    if (mode === 'follow') {
      const closeModalIfAny = () => {
        try {
          const closeButtons = document.querySelectorAll(
            '.modal .close, .modal-close, .ReactModal__Close, .ant-modal-close, [data-dismiss="modal"], [role="dialog"] [aria-label="Close"], .ms-Dialog-button--close, .ms-Dialog .ms-Dialog-button--close button'
          );
          let closed = false;
          closeButtons.forEach(btn => { try { (btn as HTMLElement).click(); closed = true; } catch { /* ignore */ } });
          if (!closed) {
            const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
            document.dispatchEvent(ev);
          }
        } catch { /* ignore */ }
      };
      tour.on('show', () => closeModalIfAny());
      tour.on('active', () => closeModalIfAny());
    }
    return tour;
  }, [markTourShown]);

  const startTabTour = useCallback((mode: 'follow' | 'guide' = 'guide') => {
    if (currentTour) {
      currentTour.complete();
    }

    // Guard against toggles being changed at runtime
    const supportedTabs = ['overview', 'analytics', 'batch', 'manage', 'policies', 'settings', 'rbac'];
    if (!(supportedTabs.includes(activeTab) && isGlobalEnabled() && isTourEnabled(activeTab as any))) {
      return;
    }

    const newTour = createTourForTab(activeTab, mode);
    if (newTour) {
      setCurrentTour(newTour);
      // Small delay to ensure DOM elements are ready
      setTimeout(() => newTour.start(), 100);
    }
  }, [activeTab, createTourForTab, currentTour]);

  // Auto-show tour for first-time tab visits (but don't auto-start)
  useEffect(() => {
    if (activeTab && !hasShownTour(activeTab)) {
      // Just log that tour is available, don't auto-start
      console.log(`First visit to ${activeTab} tab - tour available`);
    }
  }, [activeTab, hasShownTour]);

  // Clean up tour when tab changes
  useEffect(() => {
    return () => {
      if (currentTour) {
        currentTour.complete();
        setCurrentTour(null);
      }
    };
  }, [activeTab, currentTour]);

  const supportedTabs = ['overview', 'analytics', 'batch', 'manage', 'policies', 'settings', 'rbac'];
  const showTourButtons = supportedTabs.includes(activeTab) && isGlobalEnabled() && isTourEnabled(activeTab as any);

  if (!showTourButtons) {
    return null;
  }

  return (
    <div className="tab-tour-controls">
      <div className="tour-mode-selector">
        <button
          onClick={() => startTabTour('guide')}
          className="tour-btn tour-btn-guide"
          title="Quick guided tour with next/finish buttons"
        >
          📖 Quick Guide
        </button>
        
        <button
          onClick={() => startTabTour('follow')}
          className="tour-btn tour-btn-follow"
          title="Interactive follow-along tour"
        >
          🎯 Follow Along
        </button>
      </div>

      {hasShownTour(activeTab) && (
        <button
          onClick={() => resetTabTour(activeTab)}
          className="tour-btn tour-btn-reset"
          title="Reset and show tour again"
        >
          🔄 Reset Tour
        </button>
      )}

      <button
        onClick={resetAllTours}
        className="tour-btn tour-btn-reset-all"
        title="Reset all tab tours"
      >
        🗑️ Reset All
      </button>
    </div>
  );
}

export default TabTourManager;
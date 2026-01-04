import React, { useState, useCallback } from 'react';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import './UserGuideTour.css';
import { isGlobalEnabled, isTourEnabled } from './TourPrefs';

interface UserGuideTourProps {
  userRole: 'admin' | 'employee';
}

// Tour completion tracking
const useTourCompletion = (tourType: string) => {
  const storageKey = `${tourType}TourCompleted`;
  
  const [isCompleted, setIsCompleted] = useState(() => {
    return localStorage.getItem(storageKey) === 'true';
  });

  const markCompleted = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setIsCompleted(true);
  }, [storageKey]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setIsCompleted(false);
  }, [storageKey]);

  return { isCompleted, markCompleted, resetTour };
};

export function UserGuideTour({ userRole }: UserGuideTourProps) {
  const { isCompleted, markCompleted, resetTour } = useTourCompletion(userRole);
  const [tour, setTour] = useState<Shepherd.Tour | null>(null);

  const createTour = useCallback(() => {
    const newTour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        scrollTo: { behavior: 'smooth', block: 'center' },
        cancelIcon: {
          enabled: true
        },
        when: {
          complete: markCompleted,
          cancel: markCompleted
        }
      }
    });

    const steps = userRole === 'admin' ? getAdminSteps(newTour) : getEmployeeSteps(newTour);
    
  steps.forEach(step => newTour.addStep(step as any));
    
    return newTour;
  }, [userRole, markCompleted]);

  const startTour = useCallback(() => {
    if (tour) {
      tour.start();
    } else {
      const newTour = createTour();
      setTour(newTour);
      newTour.start();
    }
  }, [tour, createTour]);

  return (
    (isGlobalEnabled() && isTourEnabled('userGuide')) ? (
      <div className="user-guide-container">
        <button 
          onClick={startTour}
          className="start-tour-btn"
          title="Start User Guide Tour"
        >
          📖 User Guide
        </button>
        
        {isCompleted && (
          <button 
            onClick={resetTour}
            className="reset-tour-btn"
            title="Reset and restart tour"
          >
            🔄 Restart Tour
          </button>
        )}
      </div>
    ) : null
  );
}

// Admin tour steps
const getAdminSteps = (tour: Shepherd.Tour) => [
  {
    id: 'welcome',
    title: 'Welcome to Sunbeth Acknowledgement Portal',
    text: 'Let\'s take a quick tour of the admin dashboard features that will help you manage document acknowledgements efficiently.',
  attachTo: { element: '.admin-header', on: 'bottom' as any },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start Tour',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'navigation',
    title: 'Navigation Tabs',
    text: 'Use these tabs to navigate between different sections: Overview, Analytics, Batch Management, and Business Settings.',
  attachTo: { element: '.tab-nav', on: 'bottom' as any },
    buttons: [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics & Reports',
    text: 'View comprehensive analytics and export court-ready reports with legal consent timestamps. Select a year to filter acknowledgement data.',
  attachTo: { element: '.analytics-section', on: 'top' as any },
    buttons: [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'export-buttons',
    title: 'Export Reports',
    text: 'Export acknowledgement data as Excel or CSV files. These reports include batch details, user information, and legal consent timestamps for HR and court use.',
  attachTo: { element: '.export-buttons', on: 'top' as any },
    buttons: [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Finish',
        action: () => tour.complete()
      }
    ]
  }
];

// Employee tour steps
const getEmployeeSteps = (tour: Shepherd.Tour) => [
  {
    id: 'employee-welcome',
    title: 'Welcome to Document Acknowledgement',
    text: 'This portal helps you acknowledge important documents from your organization. Let\'s walk through how to use it.',
  attachTo: { element: '.employee-header', on: 'bottom' as any },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start Tour',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'document-list',
    title: 'Your Documents',
    text: 'Here you\'ll see all documents that require your acknowledgement. Documents are organized by batch and show their status.',
  attachTo: { element: '.document-list', on: 'top' as any },
    buttons: [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'acknowledgement-process',
    title: 'How to Acknowledge',
    text: 'Click on any document to read it, then provide your legal consent by checking the acknowledgement box and submitting.',
  attachTo: { element: '.acknowledge-button', on: 'top' as any },
    buttons: [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Finish',
        action: () => tour.complete()
      }
    ]
  }
];

export default UserGuideTour;
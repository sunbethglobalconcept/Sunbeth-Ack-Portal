import Shepherd from 'shepherd.js';
// Tour steps for different sections of the app
export const adminTourSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Sunbeth Acknowledgement Portal',
    text: 'Let\'s take a quick tour of the admin dashboard features that will help you manage document acknowledgements efficiently.',
  attachTo: { element: '.admin-header', on: 'bottom' as any },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start Tour',
        action: () => { try { (Shepherd as any).activeTour?.next(); } catch { /* noop */ } }
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
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => { try { (Shepherd as any).activeTour?.back(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => { try { (Shepherd as any).activeTour?.next(); } catch { /* noop */ } }
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
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => { try { (Shepherd as any).activeTour?.back(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => { try { (Shepherd as any).activeTour?.next(); } catch { /* noop */ } }
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
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => { try { (Shepherd as any).activeTour?.back(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => { try { (Shepherd as any).activeTour?.next(); } catch { /* noop */ } }
      }
    ]
  },
  {
    id: 'batch-management',
    title: 'Batch Management',
    text: 'Create and manage document batches here. You can add documents, set acknowledgement requirements, and track completion status.',
  attachTo: { element: '.batch-section', on: 'top' as any },
    buttons: [
      {
        text: 'Skip',
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => { try { (Shepherd as any).activeTour?.back(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => { try { (Shepherd as any).activeTour?.next(); } catch { /* noop */ } }
      }
    ]
  },
  {
    id: 'completion',
    title: 'Tour Complete!',
    text: 'You\'re all set! Remember, you can access this tour anytime from the help menu. For detailed instructions, check the HR Admin User Guide.',
    buttons: [
      {
        text: 'Finish',
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } }
      }
    ]
  }
];

export const employeeTourSteps = [
  {
    id: 'employee-welcome',
    title: 'Welcome to Document Acknowledgement',
    text: 'This portal helps you acknowledge important documents from your organization. Let\'s walk through how to use it.',
  attachTo: { element: '.employee-header', on: 'bottom' as any },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start Tour',
        action: () => { try { (Shepherd as any).activeTour?.next(); } catch { /* noop */ } }
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
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => { try { (Shepherd as any).activeTour?.back(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => { try { (Shepherd as any).activeTour?.next(); } catch { /* noop */ } }
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
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Previous',
        action: () => { try { (Shepherd as any).activeTour?.back(); } catch { /* noop */ } },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Finish',
        action: () => { try { (Shepherd as any).activeTour?.complete(); } catch { /* noop */ } }
      }
    ]
  }
];

// Tour theme configuration
export const tourOptions = {
  defaultStepOptions: {
    scrollTo: { behavior: 'smooth', block: 'center' },
    cancelIcon: {
      enabled: true
    }
  },
  useModalOverlay: true
};
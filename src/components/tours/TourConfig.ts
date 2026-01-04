// Tour configuration for Sunbeth Acknowledgement Portal
export const createAdminTourSteps = (tour: any) => [
  {
    id: 'welcome',
    title: 'Welcome to Sunbeth Acknowledgement Portal',
    text: 'Let\'s take a quick tour of the admin dashboard features that will help you manage document acknowledgements efficiently.',
    attachTo: { element: '.admin-header', on: 'bottom' },
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
    attachTo: { element: '.tab-nav', on: 'bottom' },
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
    attachTo: { element: '.analytics-section', on: 'top' },
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
    attachTo: { element: '.export-buttons', on: 'top' },
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
    id: 'batch-management',
    title: 'Batch Management',
    text: 'Create and manage document batches here. You can add documents, set acknowledgement requirements, and track completion status.',
    attachTo: { element: '.batch-section', on: 'top' },
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
    id: 'completion',
    title: 'Tour Complete!',
    text: 'You\'re all set! Remember, you can access this tour anytime from the help menu. For detailed instructions, check the HR Admin User Guide.',
    buttons: [
      {
        text: 'Finish',
        action: () => tour.complete()
      }
    ]
  }
];

export const createEmployeeTourSteps = (tour: any) => [
  {
    id: 'employee-welcome',
    title: 'Welcome to Document Acknowledgement',
    text: 'This portal helps you acknowledge important documents from your organization. Let\'s walk through how to use it.',
    attachTo: { element: '.employee-header', on: 'bottom' },
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
    attachTo: { element: '.document-list', on: 'top' },
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
    attachTo: { element: '.acknowledge-button', on: 'top' },
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
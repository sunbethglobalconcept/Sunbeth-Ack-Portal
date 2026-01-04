/* eslint-disable max-lines, max-lines-per-function, complexity */
import { showToast } from '../../utils/alerts';
// Tab-specific tour configurations for Admin Panel
export const createOverviewTourSteps = (tour: any) => [
  {
    id: 'overview-welcome',
    title: 'Overview Dashboard',
    text: 'Welcome to the Overview tab! Here you can see key statistics about your document acknowledgement system.',
    attachTo: { element: '.overview-stats', on: 'bottom' },
    buttons: [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'overview-kpis',
    title: 'Key Performance Indicators',
    text: 'Monitor active batches, total users, completion rates, and overdue batches at a glance.',
    attachTo: { element: '.kpi-stats', on: 'top' },
    buttons: [
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

export const createAnalyticsTourSteps = (tour: any, mode: 'follow' | 'guide' = 'guide') => [
  {
    id: 'analytics-welcome',
    title: 'Analytics Dashboard',
    text: 'This is your analytics center where you can view comprehensive reports and export court-ready documents.',
    attachTo: { element: '.analytics-section', on: 'top' },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'analytics-year-filter',
    title: 'Year Selector',
    text: mode === 'follow' 
      ? 'Try selecting a year from this dropdown to filter your acknowledgement data. Go ahead, click it!'
      : 'Use this dropdown to filter acknowledgement data by year for court-ready reports.',
    attachTo: { element: '.year-selector', on: 'bottom' },
  advanceOn: mode === 'follow' ? { selector: '.year-selector select, .year-selector', event: 'change' } : undefined,
    buttons: mode === 'follow' ? [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'I did it',
        action: () => tour.next()
      }
    ] : [
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
    id: 'analytics-export',
    title: 'Export Reports',
    text: mode === 'follow'
      ? 'Now try clicking one of these export buttons to download your reports. These include legal consent timestamps!'
      : 'Export your acknowledgement data as Excel or CSV files with legal consent timestamps for HR and court use.',
    attachTo: { element: '.export-buttons', on: 'top' },
  advanceOn: mode === 'follow' ? { selector: '.export-buttons button', event: 'click' } : undefined,
    buttons: mode === 'follow' ? [
      {
        text: 'Skip',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'I exported it',
        action: () => tour.next()
      }
    ] : [
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
    id: 'analytics-completion',
    title: 'Great Job!',
    text: mode === 'follow'
      ? 'Excellent! You\'ve learned how to filter and export acknowledgement data. These features are essential for HR compliance and legal documentation.'
      : 'You now know how to use the analytics dashboard to generate comprehensive reports for your organization.',
    buttons: [
      {
        text: 'Finish',
        action: () => tour.complete()
      }
    ]
  }
];

export const createBatchTourSteps = (tour: any, mode: 'follow' | 'guide' = 'guide') => [
  {
    id: 'batch-welcome',
    title: 'Batch Management',
    text: 'Welcome to batch creation and management! Create acknowledgement batches with documents, recipients, and deadlines.',
    attachTo: { element: '.batch-section', on: 'top' },
    buttons: [
      { text: 'Skip Tour', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'Start', action: () => tour.next() }
    ]
  },
  {
    id: 'batch-name',
    title: 'Name Your Batch',
    text: mode === 'follow' ? 'Type a clear, descriptive name for this batch.' : 'Provide a descriptive batch name to identify this acknowledgement round.',
    attachTo: { element: '#batchName', on: 'bottom' },
    advanceOn: mode === 'follow' ? { selector: '#batchName', event: 'input' } : undefined,
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'I named it', action: () => {
        try {
          const el = document.querySelector('#batchName') as HTMLInputElement | null;
          if (!el || !el.value || !el.value.trim()) { showToast('You have not entered the batch name', 'error'); return; }
        } catch { /* ignore */ }
        tour.next();
      } }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'batch-description',
    title: 'Add a Description',
    text: mode === 'follow' ? 'Briefly describe what users are acknowledging in this batch.' : 'Add helpful context so recipients understand what they are acknowledging.',
    attachTo: { element: '#batchDescription', on: 'bottom' },
    advanceOn: mode === 'follow' ? { selector: '#batchDescription', event: 'input' } : undefined,
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'I described it', action: () => tour.next() }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'batch-dates-start',
    title: 'Start Date',
    text: mode === 'follow' ? 'Pick when acknowledgements become available.' : 'Set the start date for when users can begin acknowledging.',
    attachTo: { element: '#batchStart', on: 'bottom' },
    advanceOn: mode === 'follow' ? { selector: '#batchStart', event: 'change' } : undefined,
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'Picked', action: () => {
        try {
          const el = document.querySelector('#batchStart') as HTMLInputElement | null;
          if (!el || !el.value || !el.value.trim()) { showToast('You have not selected the start date', 'error'); return; }
        } catch { /* ignore */ }
        tour.next();
      } }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'batch-dates-due',
    title: 'Due Date',
    text: mode === 'follow' ? 'Choose when acknowledgements are due.' : 'Set a due date to drive reminders and compliance tracking.',
    attachTo: { element: '#batchDue', on: 'bottom' },
    advanceOn: mode === 'follow' ? { selector: '#batchDue', event: 'change' } : undefined,
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'Set', action: () => {
        try {
          const el = document.querySelector('#batchDue') as HTMLInputElement | null;
          if (!el || !el.value || !el.value.trim()) { showToast('You have not selected the due date', 'error'); return; }
        } catch { /* ignore */ }
        tour.next();
      } }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'batch-selector-mode',
    title: 'Selector Mode',
    text: mode === 'follow' ? 'Toggle this to switch between inline selectors and modal pickers.' : 'Choose inline selection for speed or modal dialogs for more space.',
    attachTo: { element: '.modal-selector-toggle', on: 'top' },
    advanceOn: mode === 'follow' ? { selector: '#useModalSelectorsToggle', event: 'change' } : undefined,
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'Toggled', action: () => tour.next() }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'recipients-inline',
    title: 'Select Recipients',
    text: mode === 'follow' ? 'Use this panel to add people, groups, or departments.' : 'Choose recipients inline or via modal; groups expand to individuals for auditing.',
    attachTo: { element: '.recipients-selector, .batch-users-section', on: 'top' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'library-picker',
    title: 'Local Library',
    text: mode === 'follow' ? 'Pick documents from your local library. Try selecting one.' : 'Select documents stored in your app’s library.',
    attachTo: { element: '.library-picker-section', on: 'top' },
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'Selected', action: () => tour.next() }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'sharepoint-picker',
    title: 'SharePoint & Cloud',
    text: mode === 'follow' ? 'Browse SharePoint to attach documents. You can mix sources.' : 'Attach documents from SharePoint or other connected sources.',
    attachTo: { element: '.sharepoint-picker-section', on: 'top' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'import-progress',
    title: 'Import Progress',
    text: 'When importing many recipients, watch progress here. Errors and dedupes are clearly marked.',
    attachTo: { element: '.import-progress-banner', on: 'bottom' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'selected-documents',
    title: 'Selected Documents',
    text: 'Your chosen documents appear here. Reorder or remove as needed before creating the batch.',
    attachTo: { element: '.batch-documents-section', on: 'top' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'business-mapping',
    title: 'Business Mapping',
    text: 'Map documents to business units or roles. Apply defaults, set per-user overrides, or apply to all.',
    attachTo: { element: '.business-mapping-section', on: 'top' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'batch-summary',
    title: 'Live Summary',
    text: 'Track assignments, number of documents, and expected duration at a glance.',
    attachTo: { element: '.batch-summary', on: 'top' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'summary-assigned',
    title: 'Assigned Recipients',
    text: 'How many people will receive this batch. Expands groups automatically to individuals for auditing.',
    attachTo: { element: '.summary-assigned', on: 'bottom' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'summary-documents',
    title: 'Documents Count',
    text: 'A quick count of documents attached to this batch.',
    attachTo: { element: '.summary-documents', on: 'bottom' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'summary-duration',
    title: 'Estimated Duration',
    text: 'Rough estimate of time recipients will need. Great for planning reminders.',
    attachTo: { element: '.summary-duration', on: 'bottom' },
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'notify-options',
    title: 'Notifications',
    text: mode === 'follow' ? 'Toggle email or Teams notifications for recipients.' : 'Choose how recipients are notified and reminded (Email, Teams, etc.).',
    attachTo: { element: '.notification-options', on: 'top' },
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'Set options', action: () => tour.next() }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'preview-recipients',
    title: 'Preview Recipients',
    text: mode === 'follow' ? 'Optionally click to preview expanded recipients before sending.' : 'Preview the fully expanded recipient list (including groups) for audit confidence.',
    attachTo: { element: '#preview-recipients-button', on: 'bottom' },
    advanceOn: mode === 'follow' ? { selector: '#preview-recipients-button', event: 'click' } : undefined,
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'I previewed', action: () => tour.next() }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'grant-permissions',
    title: 'Grant Permissions (Optional)',
    text: mode === 'follow' ? 'If needed, click to grant Microsoft Graph permissions for SharePoint/Teams integration.' : 'Grant any required Graph permissions to enable cloud pickers and Teams notifications.',
    attachTo: { element: '#grant-permissions-button', on: 'bottom' },
    advanceOn: mode === 'follow' ? { selector: '#grant-permissions-button', event: 'click' } : undefined,
    buttons: mode === 'follow' ? [
      { text: 'Skip', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
      { text: 'Granted', action: () => tour.next() }
    ] : [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Next', action: () => tour.next() }
    ]
  },
  {
    id: 'batch-save',
    title: 'Create the Batch',
    text: mode === 'follow' ? 'All set! Click Save Batch to create and notify recipients.' : 'Review details, then create the batch to notify recipients.',
    attachTo: { element: '.batch-save-button', on: 'top' },
    advanceOn: mode === 'follow' ? { selector: '.batch-save-button', event: 'click' } : undefined,
    buttons: [
      { text: 'Previous', action: () => tour.back(), classes: 'shepherd-button-secondary' },
      { text: 'Finish', action: () => tour.complete() }
    ]
  }
];

export const createManageTourSteps = (tour: any) => [
  {
    id: 'manage-welcome',
    title: 'Manage Batches',
    text: 'Here you can view, edit, and manage all your existing document acknowledgement batches.',
    attachTo: { element: '.manage-section', on: 'top' },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'manage-batch-list',
    title: 'Batch List',
    text: 'View all your batches with their status, progress, and key details. Click on any batch to view details.',
    attachTo: { element: '.batch-list', on: 'top' },
    buttons: [
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
    id: 'manage-actions',
    title: 'Batch Actions',
    text: 'Use these action buttons to edit, clone, delete, or export batch data. Each batch has its own set of actions.',
    attachTo: { element: '.batch-actions', on: 'top' },
    buttons: [
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

export const createSettingsTourSteps = (tour: any) => [
  {
    id: 'settings-welcome',
    title: 'Admin Settings',
    text: 'Configure system-wide options for the portal. Let’s look at the most important controls here.',
    attachTo: { element: '.settings-section', on: 'top' },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'settings-external-support',
    title: 'External User Support',
    text: 'Toggle external login and related UI. When disabled, routes like external login and onboarding are hidden.',
    attachTo: { element: '.external-support-card', on: 'top' },
    buttons: [
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
    id: 'settings-legal-consent',
    title: 'Legal Consent Document',
    text: 'Upload or replace the PDF shown to users before acknowledgements. This is included in audit trails and reports.',
    attachTo: { element: '.legal-consent-card', on: 'top' },
    buttons: [
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

export const createPoliciesTourSteps = (tour: any) => [
  {
    id: 'policies-welcome',
    title: 'Policies & Reports',
    text: 'Define recurring policies and access consent receipts for audits and HR.',
    attachTo: { element: '.policies-section', on: 'top' },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'policies-consent-reports',
    title: 'Consent Reports',
    text: 'Download court-ready PDF reports or export JSON of consent receipts. Use filters to narrow the data.',
    attachTo: { element: '.consent-reports-card', on: 'top' },
    buttons: [
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

export const createRBACTourSteps = (tour: any) => [
  {
    id: 'rbac-welcome',
    title: 'Role-Based Access Control',
    text: 'Manage user roles and permissions to control access to different features of the system.',
    attachTo: { element: '.rbac-section', on: 'top' },
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Start',
        action: () => tour.next()
      }
    ]
  },
  {
    id: 'rbac-matrix',
    title: 'Permission Matrix',
    text: 'View and understand the permission matrix that defines what each role can access.',
    attachTo: { element: '.rbac-matrix', on: 'top' },
    buttons: [
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
    id: 'rbac-roles',
    title: 'Role Management',
    text: 'Assign and manage user roles to control their access levels throughout the system.',
    attachTo: { element: '.roles-manager', on: 'top' },
    buttons: [
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
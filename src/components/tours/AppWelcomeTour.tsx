/* eslint-disable max-lines, max-lines-per-function, @typescript-eslint/no-non-null-assertion */
import React, { useCallback, useState } from 'react';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import { isGlobalEnabled, isTourEnabled } from './TourPrefs';

/**
 * AppWelcomeTour: A global welcome tour available across the app (admin and employee).
 * - Adapts to the current page by anchoring to elements if present; otherwise centers the step.
 * - Tracks completion in localStorage and offers a restart.
 */

const STORAGE_KEY = 'appWelcomeTourCompleted';

const exists = (selector?: string | null) => !!(selector && typeof document !== 'undefined' && document.querySelector(selector));

// Helper to build a step that gracefully handles missing anchors
function buildStep(tour: Shepherd.Tour, opts: {
  id: string;
  title: string;
  text: string;
  selector?: string;
  on?: Shepherd.StepOptions['attachTo'] extends { on: infer P } ? P : 'bottom' | 'top' | 'left' | 'right';
  final?: boolean;
}): Shepherd.StepOptions {
  const { id, title, text, selector, on = 'bottom', final } = opts;
  const attachTo = exists(selector) ? { element: selector!, on } as Shepherd.StepOptions['attachTo'] : undefined;
  const buttons: Shepherd.StepOptions['buttons'] = [
    { text: 'Skip', classes: 'shepherd-button-secondary', action: () => tour.complete() },
    { text: 'Previous', classes: 'shepherd-button-secondary', action: () => tour.back() },
    final ? { text: 'Finish', action: () => tour.complete() } : { text: 'Next', action: () => tour.next() },
  ];
  // If no anchor, center it
  return {
    id,
    title,
    text,
    attachTo,
    buttons,
    when: undefined
  };
}

export default function AppWelcomeTour() {
  const [isCompleted, setCompleted] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [tour, setTour] = useState<Shepherd.Tour | null>(null);

  const markCompleted = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    setCompleted(true);
  }, []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setCompleted(false);
  }, []);

  const createTour = useCallback(() => {
    const t = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        scrollTo: { behavior: 'smooth', block: 'center' },
        cancelIcon: { enabled: true },
        modalOverlayOpeningPadding: 6,
        modalOverlayOpeningRadius: 6,
      },
    });
    t.on('complete', markCompleted);
    t.on('cancel', markCompleted);

    const steps: Shepherd.StepOptions[] = [];

    steps.push(buildStep(t, {
      id: 'welcome',
      title: 'Welcome to Sunbeth',
      text: 'Let’s take a quick tour. You can access this guide anytime from the header.',
      selector: 'header .brand',
      on: 'bottom',
    }));

    steps.push(buildStep(t, {
      id: 'dashboard',
      title: 'Dashboard overview',
      text: 'See batches and your pending items here. Admins will find an Admin View button.',
      selector: 'aside .card',
      on: 'right',
    }));

    steps.push(buildStep(t, {
      id: 'documents',
      title: 'Your documents',
      text: 'Find assigned documents in each batch. Open any to start reading.',
      selector: '.document-list',
      on: 'top',
    }));

    steps.push(buildStep(t, {
      id: 'consent',
      title: 'Legal consent',
      text: 'Before acknowledging in a batch, you may see this consent banner. Review the legal doc and continue.',
      selector: '.consent-banner',
      on: 'top',
    }));

    steps.push(buildStep(t, {
      id: 'accept',
      title: 'Acknowledge a document',
      text: 'Check the box and click I Accept to record your acknowledgement.',
      selector: '.acknowledge-button',
      on: 'top',
      final: true,
    }));

    for (const s of steps) t.addStep(s);
    return t;
  }, [markCompleted]);

  const start = useCallback(() => {
    if (tour) return tour.start();
    const t = createTour();
    setTour(t);
    t.start();
  }, [tour, createTour]);

  // Provide minimal UI controls (inline buttons)
  return (
    (isGlobalEnabled() && isTourEnabled('appWelcome')) ? (
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn ghost sm" onClick={start} title="Start app tour">🎯 Take a Tour</button>
        {isCompleted && (
          <button className="btn ghost sm" onClick={reset} title="Restart app tour">↻ Restart</button>
        )}
      </div>
    ) : null
  );
}

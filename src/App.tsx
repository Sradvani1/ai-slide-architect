import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { FAQ } from './components/landing/FAQ';
import { SharePreview } from './components/SharePreview';
import { ExplorePage } from './components/ExplorePage';
import { auth, db } from './firebaseConfig';
import { User, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { ErrorBoundary } from './components/ErrorBoundary';
import { logAnalyticsEvent, consumePendingAuthMethod, setPendingAuthMethod, clearPendingAuthMethod } from './utils/analytics';
import { ANALYTICS_EVENTS } from '@shared/constants';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const completeEmailLinkSignIn = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        return;
      }

      const storedEmail = window.localStorage.getItem('emailForSignIn');
      const email = storedEmail || window.prompt('Confirm your email to finish signing in') || '';

      if (!email) {
        return;
      }

      try {
        setPendingAuthMethod('email_link');
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem('emailForSignIn');
      } catch (error) {
        clearPendingAuthMethod();
        console.error('Email link sign-in failed:', error);
      }
    };

    completeEmailLinkSignIn();

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      const method = user ? consumePendingAuthMethod() : null;

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const isNewUser = !userSnap.exists();

        if (isNewUser) {
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
          });
        }

        if (method) {
          if (isNewUser) {
            sessionStorage.setItem('slidesedu_is_new_user', '1');
            logAnalyticsEvent(ANALYTICS_EVENTS.SIGN_UP, { method });
          } else {
            logAnalyticsEvent(ANALYTICS_EVENTS.LOGIN, { method });
          }
        }
      } else {
        sessionStorage.removeItem('slidesedu_is_new_user');
      }

      setUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main id="main-content">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="sr-only" aria-live="polite">
            Loading…
          </span>
        </main>
      </div>
    );
  }

  return (
    <ErrorBoundary resetKeys={[user?.uid]}>
      <Router>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Routes>
          <Route path="/faq" element={<FAQ />} />
          <Route path="/share/:token" element={<SharePreview user={user} />} />
          <Route path="/explore" element={<ExplorePage user={user} />} />

          {!user ? (
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/new" element={<Editor user={user} />} />
              <Route path="/project/:projectId" element={<Editor user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

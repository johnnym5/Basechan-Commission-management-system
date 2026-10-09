import React, { useEffect, useState } from 'react';
import type { AgentAccessRequest, Organization, UserAccess } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  requestOrganizationAccess,
  subscribeToOrganizations,
} from '../services/accessRequestService';
import { AlertTriangle, Building2, Clock3, ShieldCheck } from 'lucide-react';

interface OrganizationChoice {
  organizationId?: string;
  requestedOrganizationName?: string;
}

interface OrganizationRequestFormProps {
  organizations: Organization[];
  onSubmit: (choice: OrganizationChoice) => void;
  busy: boolean;
}

export const OrganizationRequestForm: React.FC<OrganizationRequestFormProps> = ({
  organizations,
  onSubmit,
  busy,
}) => {
  const [requestNewOrganization, setRequestNewOrganization] = useState(organizations.length === 0);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');

  useEffect(() => {
    if (organizations.length === 0) setRequestNewOrganization(true);
  }, [organizations.length]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (requestNewOrganization) {
      onSubmit({ requestedOrganizationName: organizationName.trim() });
    } else if (organizationId) {
      onSubmit({ organizationId });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {organizations.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
          <button
            type="button"
            aria-pressed={!requestNewOrganization}
            onClick={() => setRequestNewOrganization(false)}
            className={`rounded-lg px-3 py-2 font-semibold transition ${!requestNewOrganization ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Choose existing
          </button>
          <button
            type="button"
            aria-pressed={requestNewOrganization}
            onClick={() => setRequestNewOrganization(true)}
            className={`rounded-lg px-3 py-2 font-semibold transition ${requestNewOrganization ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Request a new organization
          </button>
        </div>
      )}

      {!requestNewOrganization && organizations.length > 0 ? (
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Existing organization</span>
          <select
            aria-label="Existing organization"
            required
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="">Select an organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Organization name</span>
          <input
            aria-label="Organization name"
            required
            minLength={2}
            maxLength={100}
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="Enter your organization"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <span className="block text-xs font-normal text-slate-500">An Admin will add it and review your access request.</span>
        </label>
      )}

      <button
        type="submit"
        disabled={busy || (!requestNewOrganization && !organizationId)}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Sending request…' : requestNewOrganization ? 'Request organization' : 'Request access'}
      </button>
    </form>
  );
};

const StatusMessage: React.FC<{ access: UserAccess; request: AgentAccessRequest | null }> = ({ access, request }) => {
  if (access.accessState === 'pending') {
    return (
      <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-bold">Your request is waiting for Admin approval</h2>
            <p className="mt-1 text-sm">You’ll see the school rates after your organization access is approved.</p>
            <p className="mt-2 text-sm font-semibold">
              Organization: {request?.requestedOrganizationName || request?.organizationId || 'Pending review'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (access.accessState === 'rejected' || access.accessState === 'revoked') {
    const revoked = access.accessState === 'revoked';
    return (
      <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <div>
            <h2 className="font-bold">{revoked ? 'Organization access has been revoked' : 'Your access request was not approved'}</h2>
            <p className="mt-1 text-sm">You can contact your Basechan administrator if you need help.</p>
            {request?.decisionNote && <p className="mt-2 text-sm">{request.decisionNote}</p>}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export const AgentAccessGate: React.FC = () => {
  const { user, access, accessRequest } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToOrganizations(
    (items) => {
      setOrganizations(items);
      setLoadingOrganizations(false);
    },
    (subscribeError) => {
      setError(subscribeError.message);
      setLoadingOrganizations(false);
    }
  ), []);

  const handleRequest = async (choice: OrganizationChoice) => {
    if (!user?.email) {
      setError('Your Google account did not provide an email address. Sign in again to request access.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestOrganizationAccess({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        ...choice,
      });
      setNotice('Your request was sent. Rates will appear after an Admin approves it.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send your request. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const showRequestForm = access.accessState === 'not_requested' || access.accessState === 'rejected' || access.accessState === 'revoked';

  return (
    <main className="min-h-screen bg-[#FDFBF7] px-4 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-800"><Building2 className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Agent account</p>
            <h1 className="text-xl font-black">Organization access</h1>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Signed in as <strong className="text-slate-900">{user?.email}</strong></span>
          </div>

          {showRequestForm && (
            <>
              <h2 className="mb-1 text-lg font-bold">{access.accessState === 'not_requested' ? 'Select your organization' : 'Request access again'}</h2>
              <p className="mb-5 text-sm leading-relaxed text-slate-600">
                Choose your organization or ask an Admin to add it. Every Agent account needs Admin approval before rates are available.
              </p>
              {loadingOrganizations ? (
                <p role="status" className="text-sm text-slate-500">Loading organizations…</p>
              ) : (
                <OrganizationRequestForm organizations={organizations} onSubmit={handleRequest} busy={busy} />
              )}
            </>
          )}

          <StatusMessage access={access} request={accessRequest} />
          {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}
        </section>
      </div>
    </main>
  );
};

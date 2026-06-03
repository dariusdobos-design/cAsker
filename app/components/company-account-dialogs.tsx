"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CompanyProfileInput } from "@/lib/companies";

export type CompanyAccountForm = CompanyProfileInput;

function AccountDialogField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="casker-dialog-field">
      <label htmlFor={id} className="casker-account-field-label">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ManageAccountDialog({
  account,
  isOpen,
  onClose,
  onSave,
  onPasswordChange,
}: {
  account: CompanyAccountForm;
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: CompanyAccountForm) => void | Promise<void>;
  onPasswordChange: (password: string) => void;
}) {
  const [draft, setDraft] = useState(account);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(account);
    setNewPassword("");
    setConfirmNewPassword("");
    setError(null);
    setIsSaving(false);
  }, [account, isOpen]);

  if (!isOpen) return null;

  const updateDraft = (updates: Partial<CompanyAccountForm>) => {
    setDraft((current) => ({ ...current, ...updates }));
    setError(null);
  };

  const copyBillingAddress = () => {
    setDraft((current) => ({
      ...current,
      operationStreet: current.billingStreet,
      operationCity: current.billingCity,
      operationZip: current.billingZip,
    }));
  };

  const handleSave = async () => {
    const trimmedEmail = draft.email.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Zadajte platný e-mail.");
      return;
    }

    if (newPassword || confirmNewPassword) {
      if (newPassword.length < 8) {
        setError("Nové heslo musí mať aspoň 8 znakov.");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError("Nové heslá sa nezhodujú.");
        return;
      }
      onPasswordChange(newPassword);
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        ...draft,
        email: trimmedEmail,
        phone: draft.phone.trim(),
        companyName: draft.companyName.trim(),
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Nepodarilo sa uložiť zmeny.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="casker-dialog-backdrop" onClick={onClose}>
      <div
        className="casker-dialog casker-dialog--account"
        role="dialog"
        aria-labelledby="manage-account-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="manage-account-title" className="casker-dialog-title">
          Spravovať účet
        </h3>
        <p className="casker-dialog-text">
          Upravte prihlasovacie údaje, fakturačnú adresu a adresu prevádzky.
        </p>

        <div className="mt-4 space-y-4">
          <section className="casker-dialog-section">
            <h4 className="casker-dialog-section-title">Prihlasovacie údaje</h4>
            <AccountDialogField id="manage-email" label="E-mail">
              <input
                id="manage-email"
                type="email"
                autoComplete="email"
                value={draft.email}
                onChange={(event) => updateDraft({ email: event.target.value })}
                className="casker-dialog-input"
                disabled={isSaving}
              />
            </AccountDialogField>
            <AccountDialogField id="manage-phone" label="Telefónny kontakt">
              <input
                id="manage-phone"
                type="tel"
                autoComplete="tel"
                value={draft.phone}
                onChange={(event) => updateDraft({ phone: event.target.value })}
                className="casker-dialog-input"
                placeholder="+421 900 000 000"
                disabled={isSaving}
              />
            </AccountDialogField>
          </section>

          <section className="casker-dialog-section">
            <h4 className="casker-dialog-section-title">Zmena hesla</h4>
            <AccountDialogField id="manage-new-password" label="Nové heslo">
              <input
                id="manage-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError(null);
                }}
                className="casker-dialog-input"
                disabled={isSaving}
              />
            </AccountDialogField>
            <AccountDialogField id="manage-confirm-password" label="Potvrdenie nového hesla">
              <input
                id="manage-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(event) => {
                  setConfirmNewPassword(event.target.value);
                  setError(null);
                }}
                className="casker-dialog-input"
                disabled={isSaving}
              />
            </AccountDialogField>
          </section>

          <section className="casker-dialog-section">
            <h4 className="casker-dialog-section-title">Firemné údaje</h4>
            <AccountDialogField id="manage-company-name" label="Obchodné meno">
              <input
                id="manage-company-name"
                type="text"
                value={draft.companyName}
                onChange={(event) => updateDraft({ companyName: event.target.value })}
                className="casker-dialog-input"
                disabled={isSaving}
              />
            </AccountDialogField>
            <AccountDialogField id="manage-ico" label="IČO">
              <input
                id="manage-ico"
                type="text"
                inputMode="numeric"
                value={draft.ico}
                onChange={(event) => updateDraft({ ico: event.target.value })}
                className="casker-dialog-input"
                disabled={isSaving}
              />
            </AccountDialogField>
            <AccountDialogField id="manage-billing-street" label="Fakturačná adresa – ulica a číslo">
              <input
                id="manage-billing-street"
                type="text"
                value={draft.billingStreet}
                onChange={(event) => updateDraft({ billingStreet: event.target.value })}
                className="casker-dialog-input"
                disabled={isSaving}
              />
            </AccountDialogField>
            <div className="casker-dialog-grid-2">
              <AccountDialogField id="manage-billing-city" label="Mesto">
                <input
                  id="manage-billing-city"
                  type="text"
                  value={draft.billingCity}
                  onChange={(event) => updateDraft({ billingCity: event.target.value })}
                  className="casker-dialog-input"
                  disabled={isSaving}
                />
              </AccountDialogField>
              <AccountDialogField id="manage-billing-zip" label="PSČ">
                <input
                  id="manage-billing-zip"
                  type="text"
                  value={draft.billingZip}
                  onChange={(event) => updateDraft({ billingZip: event.target.value })}
                  className="casker-dialog-input"
                  disabled={isSaving}
                />
              </AccountDialogField>
            </div>
            <div className="casker-dialog-grid-2">
              <AccountDialogField id="manage-dic" label="DIČ">
                <input
                  id="manage-dic"
                  type="text"
                  value={draft.dic}
                  onChange={(event) => updateDraft({ dic: event.target.value })}
                  className="casker-dialog-input"
                  disabled={isSaving}
                />
              </AccountDialogField>
              <AccountDialogField id="manage-ic-dph" label="IČ DPH">
                <input
                  id="manage-ic-dph"
                  type="text"
                  value={draft.icDph}
                  onChange={(event) => updateDraft({ icDph: event.target.value })}
                  className="casker-dialog-input"
                  disabled={isSaving}
                />
              </AccountDialogField>
            </div>
          </section>

          <section className="casker-dialog-section">
            <h4 className="casker-dialog-section-title">Adresa prevádzky</h4>
            <button
              type="button"
              onClick={copyBillingAddress}
              className="mb-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              disabled={isSaving}
            >
              Použiť fakturačnú adresu
            </button>
            <AccountDialogField id="manage-operation-street" label="Ulica">
              <input
                id="manage-operation-street"
                type="text"
                value={draft.operationStreet}
                onChange={(event) => updateDraft({ operationStreet: event.target.value })}
                className="casker-dialog-input"
                disabled={isSaving}
              />
            </AccountDialogField>
            <div className="casker-dialog-grid-2">
              <AccountDialogField id="manage-operation-city" label="Mesto">
                <input
                  id="manage-operation-city"
                  type="text"
                  value={draft.operationCity}
                  onChange={(event) => updateDraft({ operationCity: event.target.value })}
                  className="casker-dialog-input"
                  disabled={isSaving}
                />
              </AccountDialogField>
              <AccountDialogField id="manage-operation-zip" label="PSČ">
                <input
                  id="manage-operation-zip"
                  type="text"
                  value={draft.operationZip}
                  onChange={(event) => updateDraft({ operationZip: event.target.value })}
                  className="casker-dialog-input"
                  disabled={isSaving}
                />
              </AccountDialogField>
            </div>
          </section>
        </div>

        {error ? <p className="casker-dialog-error">{error}</p> : null}

        <div className="casker-dialog-actions">
          <button
            type="button"
            className="casker-dialog-btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Zrušiť
          </button>
          <button
            type="button"
            className="casker-complete-btn"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? "Ukladám…" : "Uložiť zmeny"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionDialog({
  isOpen,
  hasPremium,
  onClose,
}: {
  isOpen: boolean;
  hasPremium: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="casker-dialog-backdrop" onClick={onClose}>
      <div
        className="casker-dialog"
        role="dialog"
        aria-labelledby="subscription-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="subscription-title" className="casker-dialog-title">
          Predplatné cAsker Premium
        </h3>
        <p className="casker-dialog-text">
          Stav vášho účtu a možnosti aktivácie Premium.
        </p>

        <div className="mt-4">
          <span
            className={`casker-subscription-badge ${hasPremium ? "is-active" : "is-inactive"}`}
          >
            {hasPremium ? "Premium aktívne" : "Premium neaktívne"}
          </span>
        </div>

        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-700">
          <li>• Detail vozidla, popis závady a kontakt na zákazníka</li>
          <li>• Prijímanie a odpovedanie na dopyty v reálnom čase</li>
          <li>• Plný prístup k dashboardu bez obmedzení</li>
        </ul>

        {!hasPremium ? (
          <button
            type="button"
            className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500"
          >
            Aktivovať Premium
          </button>
        ) : null}

        <div className="casker-dialog-actions casker-dialog-actions--single">
          <button type="button" className="casker-dialog-btn-secondary" onClick={onClose}>
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
}

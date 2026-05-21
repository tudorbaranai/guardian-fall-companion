"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettings } from "./settings-provider";
import { CloseIcon } from "./icons";

/**
 * Modal form for adding a new emergency contact. Captures name, relation
 * and at least one reachable channel (email or phone) — both are saved so
 * the alert pipeline can either email the contact (via `/api/notify`) or
 * surface their number as a call-to button on the Fall Alert dialog.
 */
export function AddContactDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const { addContact } = useSettings();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset the form whenever the modal is closed, so reopening starts fresh.
  // The local form state is owned by this dialog and exists only to be
  // cleared on close — the cascade warning doesn't apply here.
  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName("");
      setRelation("");
      setEmail("");
      setPhone("");
      setSubmitting(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  // Lock the page scroll while the modal owns the screen.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const validEmail = email.trim() === "" || /^\S+@\S+\.\S+$/.test(email);
  const canSave =
    name.trim().length > 0 &&
    relation.trim().length > 0 &&
    (email.trim() || phone.trim()) &&
    validEmail &&
    !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSubmitting(true);
    addContact({
      name: name.trim(),
      relation: relation.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="modal-backdrop-in absolute inset-0 cursor-default bg-navy/25 backdrop-blur-md"
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-pop-in relative flex w-full max-w-[440px] flex-col gap-4 rounded-[22px] bg-canvas px-5 py-5 shadow-[0_24px_70px_rgba(19,24,38,0.35)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className="text-[22px] font-bold tracking-[-0.01em] text-ink"
            >
              Add a contact
            </h2>
            <p className="mt-1 text-[14px] leading-snug text-ink-2">
              They will be emailed when a fall is detected. A phone number
              also lets the alert dial them directly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-ink-2 hover:bg-white"
          >
            <CloseIcon size={18} sw={2.2} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ana"
              autoFocus
            />
          </Field>
          <Field label="Relation" required>
            <Input
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="Daughter"
            />
          </Field>
        </div>

        <Field
          label="Email"
          hint={
            email && !validEmail ? "That doesn't look like an email." : undefined
          }
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@example.com"
            invalid={!validEmail && email !== ""}
          />
        </Field>

        <Field label="Phone">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+40 720 000 000"
          />
        </Field>

        <p className="text-[12px] text-ink-3">
          At least one of email or phone is required.
        </p>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-[14px] border-navy/15 text-[15px] font-bold text-ink"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSave}
            className={cn(
              "h-11 rounded-[14px] bg-navy text-[15px] font-bold text-[#eaf1f8] hover:bg-navy",
              !canSave && "opacity-50",
            )}
          >
            Save contact
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-alert">*</span>}
      </span>
      {children}
      {hint && <span className="text-[12px] text-alert">{hint}</span>}
    </label>
  );
}

function Input({
  invalid,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      className={cn(
        "h-11 rounded-[12px] border bg-surface px-3 text-[15px] text-ink outline-none transition-colors",
        invalid
          ? "border-alert focus:border-alert"
          : "border-navy/15 focus:border-navy/40",
      )}
    />
  );
}

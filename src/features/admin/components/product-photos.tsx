"use client";

/* ---------------------------------------------------------------------------
   ProductPhotos — add, order and remove one product's photos (D117).

   On the edit page only: a photo belongs to a product that already exists.
   Rules, owner 2026-10-01: up to 8 photos, 10 MB each, JPEG / PNG / WebP;
   shown whole inside the square, never cropped; the first is the main photo
   (the storefront card's); removing one deletes the file too, after a
   confirm. No drag and drop: on a phone or tablet, buttons are the reliable
   way to reorder.

   Each upload goes straight from the browser to Vercel Blob with a one-time
   token (`photo-actions.ts` explains why). Files upload one after another,
   so the progress line is honest and the eighth-photo limit is checked per
   file by the server. After each change the page is refreshed from the
   server, which is the one source of the photo list.
   --------------------------------------------------------------------------- */

import { put } from "@vercel/blob/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { addPhoto, movePhoto, removePhoto, requestPhotoUpload } from "../photo-actions";
import {
  PHOTO_ACCEPT,
  PHOTO_FIELD,
  PHOTO_LIMITS,
  PRODUCT_ID_FIELD,
  type PhotoActionResult,
} from "../product-types";
import { ADMIN_CSRF_FIELD } from "../types";

export interface PhotoView {
  id: string;
  url: string;
  alt: string;
}

const MB = 1024 * 1024;

export function ProductPhotos({
  productId,
  csrfToken,
  photos,
  inert = false,
}: {
  productId: string;
  csrfToken: string;
  photos: readonly PhotoView[];
  /** The admin styleguide: render the states, act on nothing. */
  inert?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [, startRefresh] = useTransition();

  const room = PHOTO_LIMITS.perProduct - photos.length;

  function baseForm(): FormData {
    const formData = new FormData();
    formData.set(ADMIN_CSRF_FIELD, csrfToken);
    formData.set(PRODUCT_ID_FIELD, productId);
    return formData;
  }

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function uploadOne(file: File): Promise<string | null> {
    if (!(PHOTO_LIMITS.contentTypes as readonly string[]).includes(file.type)) {
      return `${file.name}: use a JPEG, PNG or WebP photo.`;
    }
    if (file.size > PHOTO_LIMITS.maxBytes) {
      return `${file.name}: ${(file.size / MB).toFixed(1)} MB is over the 10 MB limit.`;
    }

    const ticketForm = baseForm();
    ticketForm.set(PHOTO_FIELD.fileName, file.name);
    ticketForm.set(PHOTO_FIELD.contentType, file.type);
    ticketForm.set(PHOTO_FIELD.size, String(file.size));
    const ticket = await requestPhotoUpload(ticketForm);
    if (!ticket.ok) return `${file.name}: ${ticket.message}`;

    let url: string;
    try {
      const blob = await put(ticket.pathname, file, {
        access: "public",
        token: ticket.token,
        contentType: file.type,
      });
      url = blob.url;
    } catch {
      return `${file.name}: the upload did not finish. Check the connection and try again.`;
    }

    const recordForm = baseForm();
    recordForm.set(PHOTO_FIELD.url, url);
    const recorded = await addPhoto(recordForm);
    return recorded.ok ? null : `${file.name}: ${recorded.message}`;
  }

  async function uploadAll(files: File[]) {
    setProblems([]);
    if (files.length === 0) return;
    const accepted = files.slice(0, Math.max(room, 0));
    const skipped = files.length - accepted.length;
    const found: string[] = [];
    if (skipped > 0) {
      found.push(
        `${skipped === 1 ? "1 photo was" : `${skipped} photos were`} left out: a product holds ${PHOTO_LIMITS.perProduct}.`,
      );
    }
    setBusy(true);
    for (const [index, file] of accepted.entries()) {
      setProgress(accepted.length === 1 ? "Uploading…" : `Uploading ${index + 1} of ${accepted.length}…`);
      let problem: string | null;
      try {
        problem = await uploadOne(file);
      } catch {
        problem = `${file.name}: something went wrong. Reload the page and try again.`;
      }
      if (problem) found.push(problem);
      refresh();
    }
    setProgress(null);
    setBusy(false);
    setProblems(found);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function act(run: () => Promise<PhotoActionResult>) {
    setProblems([]);
    setBusy(true);
    let result: PhotoActionResult;
    try {
      result = await run();
    } catch {
      result = { ok: false, message: "Something went wrong. Reload the page and try again." };
    }
    setBusy(false);
    if (!result.ok) setProblems([result.message]);
    refresh();
  }

  function move(photoId: string, to: "first" | "earlier" | "later") {
    const formData = baseForm();
    formData.set(PHOTO_FIELD.photoId, photoId);
    formData.set(PHOTO_FIELD.move, to);
    return act(() => movePhoto(formData));
  }

  function remove(photoId: string) {
    if (!window.confirm("Remove this photo? It is deleted for good.")) return;
    const formData = baseForm();
    formData.set(PHOTO_FIELD.photoId, photoId);
    return act(() => removePhoto(formData));
  }

  const disabled = busy || inert;

  return (
    <div className="flex flex-col gap-5">
      {photos.length === 0 ? (
        <p className="text-ink-muted text-15 leading-body">
          No photos yet. The storefront shows the brand name in their place.
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="bg-surface border-border-strong flex flex-col border">
              <div className="bg-surface-2 relative aspect-square">
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 1100px) 240px, (min-width: 720px) 30vw, 45vw"
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col gap-1 p-2 sm:p-3">
                <span className={`label text-11 tracking-12 ${index === 0 ? "text-accent" : "text-ink-dim"}`}>
                  {index === 0 ? "Main photo" : `Photo ${index + 1}`}
                </span>
                <div className="flex flex-wrap gap-x-3">
                  {index > 0 ? (
                    <Button type="button" variant="tertiary" size="compact" disabled={disabled} onClick={() => move(photo.id, "first")}>
                      Make main
                    </Button>
                  ) : null}
                  {index > 0 ? (
                    <Button
                      type="button"
                      variant="tertiary"
                      size="compact"
                      disabled={disabled}
                      aria-label={`Move photo ${index + 1} earlier`}
                      onClick={() => move(photo.id, "earlier")}
                    >
                      Earlier
                    </Button>
                  ) : null}
                  {index < photos.length - 1 ? (
                    <Button
                      type="button"
                      variant="tertiary"
                      size="compact"
                      disabled={disabled}
                      aria-label={`Move photo ${index + 1} later`}
                      onClick={() => move(photo.id, "later")}
                    >
                      Later
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="tertiary"
                    size="compact"
                    disabled={disabled}
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() => remove(photo.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {room > 0 ? (
        <div className="flex flex-col gap-2">
          {/* The real input is visually hidden and driven by the button, so the
              control looks like every other button here; the label keeps it
              named for assistive tech. */}
          <label htmlFor={inputId} className="sr-only">
            Add photos
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(event) => void uploadAll(Array.from(event.currentTarget.files ?? []))}
          />
          <div>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {busy && progress ? progress : photos.length === 0 ? "Add photos" : "Add more photos"}
            </Button>
          </div>
          <p className="text-ink-dim text-13 leading-body">
            {`JPEG, PNG or WebP, up to 10 MB each. Room for ${room === 1 ? "1 more" : `${room} more`}.`}
          </p>
        </div>
      ) : (
        <p className="text-ink-dim text-13 leading-body">
          {`${PHOTO_LIMITS.perProduct} photos is the most a product holds. Remove one to add another.`}
        </p>
      )}

      {problems.length > 0 ? (
        <ul role="alert" className="border-accent bg-accent-subtle text-ink flex flex-col gap-1 border p-3 text-14 leading-body">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

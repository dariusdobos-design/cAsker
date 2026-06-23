"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, Plus, Trash2, Warehouse, X } from "lucide-react";
import { fetchCurrentCompanyProfile } from "@/lib/companies";
import {
  fetchServiceProfile,
  saveServiceProfile,
  type ServiceProfile,
  type ServiceProfilePost,
} from "@/lib/service-profile";
import { createClient } from "@/lib/supabase/client";

const MAX_LOGO_DIMENSION = 640;

/* Fotku zmenšíme v prehliadači, aby sa do databázy neukladali
   niekoľkomegabajtové originály z mobilu. */
async function fileToResizedDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Obrázok sa nepodarilo načítať."));
      img.src = objectUrl;
    });

    const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Obrázok sa nepodarilo spracovať.");
    }

    context.drawImage(image, 0, 0, width, height);

    const usePng = file.type === "image/png" || file.type === "image/svg+xml";
    return usePng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatPostDate(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("sk-SK");
}

export default function ServiceProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const postPhotosInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [operationCity, setOperationCity] = useState("");
  const [posts, setPosts] = useState<ServiceProfilePost[]>([]);

  const [newService, setNewService] = useState("");
  const [newPostDescription, setNewPostDescription] = useState("");
  const [newPostPhotos, setNewPostPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/auth?next=/profile");
          return;
        }

        const [company, profile] = await Promise.all([
          fetchCurrentCompanyProfile().catch(() => null),
          fetchServiceProfile(),
        ]);

        if (cancelled) return;

        setDisplayName(profile?.displayName || company?.companyName || "");
        setAbout(profile?.about ?? "");
        setServices(profile?.services ?? []);
        setLogoDataUrl(profile?.logoDataUrl ?? null);
        setPosts(profile?.posts ?? []);
        setOperationCity(company?.operationCity || company?.billingCity || "");
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Profil sa nepodarilo načítať.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setLogoDataUrl(dataUrl);
      setSaveError(null);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Fotku sa nepodarilo spracovať.",
      );
    }
  };

  const handleAddService = () => {
    const value = newService.trim();
    if (!value) return;

    setServices((current) =>
      current.some((item) => item.toLowerCase() === value.toLowerCase())
        ? current
        : [...current, value],
    );
    setNewService("");
  };

  const handleRemoveService = (service: string) => {
    setServices((current) => current.filter((item) => item !== service));
  };

  const handlePickPostPhotos = () => {
    postPhotosInputRef.current?.click();
  };

  const handlePostPhotosSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    try {
      const dataUrls = await Promise.all(files.map((file) => fileToResizedDataUrl(file)));
      setNewPostPhotos((current) => [...current, ...dataUrls]);
      setSaveError(null);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Fotky sa nepodarilo spracovať.",
      );
    }
  };

  const handleRemoveNewPostPhoto = (index: number) => {
    setNewPostPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  };

  const handleAddPost = () => {
    const description = newPostDescription.trim();
    if (!description && newPostPhotos.length === 0) return;

    const post: ServiceProfilePost = {
      id: crypto.randomUUID(),
      description,
      photos: newPostPhotos,
      createdAt: new Date().toISOString(),
    };

    setPosts((current) => [post, ...current]);
    setNewPostDescription("");
    setNewPostPhotos([]);
  };

  const handleRemovePost = (postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    const profile: ServiceProfile = {
      displayName,
      about,
      services,
      logoDataUrl,
      posts,
    };

    try {
      const saved = await saveServiceProfile(profile);
      setDisplayName(saved.displayName);
      setAbout(saved.about);
      setServices(saved.services);
      setLogoDataUrl(saved.logoDataUrl);
      setPosts(saved.posts);
      setSavedAt(Date.now());
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Profil sa nepodarilo uložiť.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!savedAt) return;
    const timeout = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(timeout);
  }, [savedAt]);

  return (
    /* body má overflow:hidden (kvôli dashboardu), preto stránka roluje sama */
    <div className="h-screen overflow-y-auto bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Dashboard
          </Link>
          <h1 className="text-lg font-bold text-[#0b194f]">Profil servisu</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500">
            Načítavam profil…
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
            {loadError}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Hlavička profilu */}
            <div className="bg-gradient-to-br from-[#16276b] to-[#0b194f] px-6 pb-6 pt-7">
              <div className="flex items-start gap-5">
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePickPhoto}
                    className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-white/40 bg-white shadow-lg transition hover:border-white"
                    aria-label="Nahrať logo alebo fotku prevádzky"
                  >
                    {logoDataUrl ? (
                      <img
                        src={logoDataUrl}
                        alt="Logo servisu"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-slate-100">
                        <Warehouse className="h-12 w-12 text-slate-400" strokeWidth={1.75} />
                      </span>
                    )}

                    {/* Veľké + cez celú ikonu */}
                    <span
                      className={`absolute inset-0 flex items-center justify-center transition ${
                        logoDataUrl
                          ? "bg-slate-900/0 opacity-0 group-hover:bg-slate-900/40 group-hover:opacity-100"
                          : "bg-slate-900/15"
                      }`}
                    >
                      <Plus
                        className="h-16 w-16 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                        strokeWidth={2.5}
                      />
                    </span>
                  </button>
                  <span className="text-[11px] font-medium text-white/70">
                    Logo / fotka prevádzky
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handlePhotoSelected(event)}
                  />
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <label
                    htmlFor="profile-display-name"
                    className="text-[11px] font-bold uppercase tracking-wide text-white/60"
                  >
                    Názov servisu
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Názov servisu"
                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xl font-bold text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
                  />
                  {operationCity ? (
                    <p className="mt-2 text-sm font-medium text-white/70">{operationCity}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* O nás */}
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#0b194f]">
                  O nás
                </h2>
                <textarea
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  rows={5}
                  placeholder="Predstavte svoj servis zákazníkom — čomu sa venujete, aké máte skúsenosti, prečo si vybrať práve vás…"
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#0b194f] focus:bg-white focus:outline-none"
                />
              </section>

              {/* Ponúkané služby */}
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#0b194f]">
                  Ponúkané služby
                </h2>

                {services.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {services.map((service) => (
                      <li
                        key={service}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1.5 pl-3.5 pr-2 text-sm font-semibold text-[#0b194f]"
                      >
                        {service}
                        <button
                          type="button"
                          onClick={() => handleRemoveService(service)}
                          className="rounded-full p-0.5 text-slate-400 transition hover:bg-blue-100 hover:text-red-600"
                          aria-label={`Odstrániť službu ${service}`}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    Zatiaľ žiadne služby — pridajte napríklad „Výmena oleja“, „Prezutie
                    pneumatík“ alebo „Diagnostika“.
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newService}
                    onChange={(event) => setNewService(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddService();
                      }
                    }}
                    placeholder="Napr. Výmena oleja"
                    className="w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0b194f] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#0b194f] px-3.5 py-2 text-sm font-bold text-[#0b194f] transition hover:bg-[#0b194f] hover:text-white"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Pridať
                  </button>
                </div>
              </section>

              {/* Príspevky s fotkami */}
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#0b194f]">
                  Naše práce
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Pochváľte sa fotkami svojej práce — zákazníci ich uvidia vo vašom profile
                  v aplikácii.
                </p>

                {/* Nový príspevok */}
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <textarea
                    value={newPostDescription}
                    onChange={(event) => setNewPostDescription(event.target.value)}
                    rows={3}
                    placeholder="Popis k fotkám — napr. „Kompletná výmena brzdových kotúčov na BMW radu 3“…"
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#0b194f] focus:outline-none"
                  />

                  {newPostPhotos.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {newPostPhotos.map((photo, index) => (
                        <li key={`${index}-${photo.slice(-24)}`} className="relative">
                          <img
                            src={photo}
                            alt={`Fotka ${index + 1}`}
                            className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewPostPhoto(index)}
                            className="absolute -right-1.5 -top-1.5 rounded-full border border-slate-200 bg-white p-0.5 text-slate-500 shadow-sm transition hover:text-red-600"
                            aria-label="Odstrániť fotku"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePickPostPhotos}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0b194f] hover:text-[#0b194f]"
                    >
                      <ImagePlus className="h-4 w-4" strokeWidth={2.25} />
                      Pridať fotky
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPost}
                      disabled={!newPostDescription.trim() && newPostPhotos.length === 0}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#0b194f] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#13235f] disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                      Pridať príspevok
                    </button>
                  </div>
                  <input
                    ref={postPhotosInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => void handlePostPhotosSelected(event)}
                  />
                </div>

                {/* Zoznam príspevkov */}
                {posts.length > 0 ? (
                  <ul className="mt-4 space-y-4">
                    {posts.map((post) => (
                      <li
                        key={post.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {post.description ? (
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                {post.description}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs font-medium text-slate-400">
                              {formatPostDate(post.createdAt)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePost(post.id)}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            aria-label="Odstrániť príspevok"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                          </button>
                        </div>

                        {post.photos.length > 0 ? (
                          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {post.photos.map((photo, index) => (
                              <li key={`${post.id}-${index}`}>
                                <img
                                  src={photo}
                                  alt={`Fotka ${index + 1}`}
                                  className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Zatiaľ žiadne príspevky.</p>
                )}
              </section>

              {/* Uloženie */}
              <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0b194f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#13235f] disabled:opacity-60"
                >
                  {isSaving ? "Ukladám…" : "Uložiť profil"}
                </button>

                {savedAt ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Profil uložený
                  </span>
                ) : null}

                {saveError ? (
                  <span className="text-sm font-medium text-red-600">{saveError}</span>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Event,
  EventSettings,
  ScreenBackground,
  ScreenKey,
  TemplateCategory,
  Filter,
} from '../../types/photobooth';
import { AppSettings } from '../../types/admin';
import {
  EventService,
  slugify,
  generateInitialsPrefix,
  compressImageToWebp,
} from '../../services/eventService';
import { StudioService } from '../../services/studioService';
import { FilterService } from '../../services/filterService';
import { useToast } from '../components/Toast';
import { QrPosterModal } from '../components/QrPosterModal';
import {
  X,
  Check,
  Calendar,
  Layers,
  Sliders,
  Image as ImageIcon,
  QrCode,
  Copy,
  ExternalLink,
  Download,
  Printer,
  Sparkles,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  Smartphone,
  Upload,
} from 'lucide-react';

interface UserEventFormModalProps {
  isOpen: boolean;
  eventToEdit: Event | null; // null for new event
  appSettings: AppSettings;
  onClose: () => void;
  onSaved: (event: Event) => void;
}

type TabKey = 'info' | 'template' | 'settings' | 'background' | 'qr';

export const UserEventFormModal: React.FC<UserEventFormModalProps> = ({
  isOpen,
  eventToEdit,
  appSettings,
  onClose,
  onSaved,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  // Tab 1: Info Acara
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [codePrefix, setCodePrefix] = useState('');
  const [isPrefixManuallyEdited, setIsPrefixManuallyEdited] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [coupleNames, setCoupleNames] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [quoteSource, setQuoteSource] = useState('');
  const [activeFrom, setActiveFrom] = useState('');
  const [activeUntil, setActiveUntil] = useState('');
  const [status, setStatus] = useState<'aktif' | 'nonaktif' | 'selesai'>('aktif');

  // Live Uniqueness Check Status
  const [slugError, setSlugError] = useState<string | null>(null);
  const [prefixError, setPrefixError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isCheckingPrefix, setIsCheckingPrefix] = useState(false);

  // Tab 2: Template & Filter
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [allFilters, setAllFilters] = useState<Filter[]>([]);
  const [selectedFilterIds, setSelectedFilterIds] = useState<string[]>([]);

  // Tab 3: Pengaturan Photobooth
  const [retentionHours, setRetentionHours] = useState(120);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [defaultMirror, setDefaultMirror] = useState(true);

  // Tab 4: Backgrounds (6 Screens)
  const [backgrounds, setBackgrounds] = useState<ScreenBackground[]>([]);
  const [activeScreenBgKey, setActiveScreenBgKey] = useState<ScreenKey>('landing');
  const [isCompressingBg, setIsCompressingBg] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Tab 5: QR & Poster
  const [qrPngUrl, setQrPngUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');
  const [showPosterModal, setShowPosterModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute Base URL for Guest Link & QR
  const baseUrl = (appSettings.public_base_url || window.location.origin).replace(/\/+$/, '');
  const guestLink = `${baseUrl}/e/${slug || 'demo'}`;

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    // Load available categories and filters
    Promise.all([StudioService.getCategories(), FilterService.getAllAdminFilters()]).then(
      ([cats, flts]) => {
        setCategories(cats);
        setAllFilters(flts);

        if (eventToEdit) {
          // Edit existing event
          setName(eventToEdit.name);
          setSlug(eventToEdit.slug);
          setIsSlugManuallyEdited(true);
          setCodePrefix(eventToEdit.code_prefix);
          setIsPrefixManuallyEdited(true);
          setEventDate(eventToEdit.event_date);
          setCoupleNames(eventToEdit.couple_names);
          setQuoteText(eventToEdit.quote_text || '');
          setQuoteSource(eventToEdit.quote_source || '');
          setActiveFrom(eventToEdit.active_from ? eventToEdit.active_from.slice(0, 16) : '');
          setActiveUntil(eventToEdit.active_until ? eventToEdit.active_until.slice(0, 16) : '');
          setStatus(eventToEdit.status || 'aktif');
          setSelectedCategoryId(eventToEdit.template_category_id || (cats[0]?.id ?? ''));

          // Load event settings, filters, and backgrounds
          const stg = EventService.getStoredEventSettings(eventToEdit.id);
          setRetentionHours(stg.retention_hours || 120);
          setCountdownSeconds(stg.countdown_seconds || 3);
          setDefaultMirror(stg.default_mirror !== false);

          const fIds = EventService.getStoredEventFilters(eventToEdit.id);
          setSelectedFilterIds(fIds.length > 0 ? fIds : flts.map((f) => f.id));

          const bgs = EventService.getStoredScreenBackgrounds(eventToEdit.id);
          setBackgrounds(bgs);
        } else {
          // Create new event defaults
          const defaultName = '';
          setName(defaultName);
          setSlug('');
          setIsSlugManuallyEdited(false);
          setCodePrefix('');
          setIsPrefixManuallyEdited(false);
          setEventDate('15 November 2026');
          setCoupleNames('');
          setQuoteText(
            'Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri.'
          );
          setQuoteSource('QS. Ar-Rum: 21');
          setActiveFrom(new Date().toISOString().slice(0, 16));
          setActiveUntil(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 16));
          setStatus('aktif');
          setSelectedCategoryId(cats[0]?.id ?? '');
          setSelectedFilterIds(flts.map((f) => f.id));
          setRetentionHours(120);
          setCountdownSeconds(3);
          setDefaultMirror(true);
          setBackgrounds(EventService.getDefaultBackgrounds('temp_new'));
        }
      }
    );
  }, [isOpen, eventToEdit]);

  // Auto-generate slug and prefix when name changes (if not manually edited)
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
    if (!isPrefixManuallyEdited) {
      setCodePrefix(generateInitialsPrefix(val));
    }
    if (!eventToEdit && !coupleNames) {
      setCoupleNames(val);
    }
  };

  // Live Uniqueness Check for Slug
  useEffect(() => {
    if (!slug.trim()) {
      setSlugError(null);
      return;
    }
    let isCancelled = false;
    setIsCheckingSlug(true);

    const timer = setTimeout(async () => {
      const isUnique = await EventService.checkSlugUnique(slug, eventToEdit?.id);
      if (!isCancelled) {
        setIsCheckingSlug(false);
        if (!isUnique) {
          setSlugError('Slug ini sudah digunakan oleh acara lain');
        } else {
          setSlugError(null);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [slug, eventToEdit]);

  // Live Uniqueness Check for Code Prefix
  useEffect(() => {
    const clean = codePrefix.trim().toUpperCase();
    if (!clean) {
      setPrefixError(null);
      return;
    }
    if (clean.length < 2 || clean.length > 4) {
      setPrefixError('Kode prefix harus 2 sampai 4 huruf');
      return;
    }

    let isCancelled = false;
    setIsCheckingPrefix(true);

    const timer = setTimeout(async () => {
      const isUnique = await EventService.checkPrefixUnique(clean, eventToEdit?.id);
      if (!isCancelled) {
        setIsCheckingPrefix(false);
        if (!isUnique) {
          setPrefixError('Kode prefix ini sudah digunakan oleh acara lain');
        } else {
          setPrefixError(null);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [codePrefix, eventToEdit]);

  // Generate QR for Tab 5
  useEffect(() => {
    if (!slug) return;
    QRCode.toDataURL(guestLink, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
    })
      .then((url) => setQrPngUrl(url))
      .catch(() => {});

    QRCode.toString(guestLink, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
    })
      .then((svg) => setQrSvgString(svg))
      .catch(() => {});
  }, [slug, guestLink]);

  if (!isOpen) return null;

  // Active Screen Background Data
  const currentBg =
    backgrounds.find((bg) => bg.screen_key === activeScreenBgKey) || {
      event_id: eventToEdit?.id || 'temp',
      screen_key: activeScreenBgKey,
      media_url:
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      media_type: 'image',
      blur_px: activeScreenBgKey === 'landing' ? 0 : 8,
      overlay_opacity: activeScreenBgKey === 'landing' ? 0.4 : 0.6,
    };

  const updateCurrentBg = (partial: Partial<ScreenBackground>) => {
    setBackgrounds((prev) => {
      const idx = prev.findIndex((b) => b.screen_key === activeScreenBgKey);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...partial };
        return copy;
      } else {
        return [...prev, { ...currentBg, ...partial }];
      }
    });
  };

  const handleApplyBgToAll = () => {
    setBackgrounds((prev) =>
      prev.map((b) => ({
        ...b,
        media_url: currentBg.media_url,
        media_type: currentBg.media_type,
        blur_px: b.screen_key === 'landing' ? 0 : currentBg.blur_px,
        overlay_opacity: currentBg.overlay_opacity,
      }))
    );
    addToast('Background berhasil diterapkan ke semua 6 layar', 'success');
  };

  const handleBgMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mime = file.type;
    const isVideo = mime.startsWith('video/');
    const isGif = mime === 'image/gif';
    const isImage = mime.startsWith('image/') && !isGif;

    // Check size constraints
    if (isImage && file.size > 5 * 1024 * 1024) {
      addToast('Ukuran gambar maksimal 5MB', 'error');
      return;
    }
    if (isGif && file.size > 10 * 1024 * 1024) {
      addToast('Ukuran GIF maksimal 10MB', 'error');
      return;
    }
    if (isVideo && file.size > 15 * 1024 * 1024) {
      addToast('Ukuran video maksimal 15MB', 'error');
      return;
    }

    setIsCompressingBg(true);
    try {
      if (isImage) {
        const webpUrl = await compressImageToWebp(file, 1920);
        updateCurrentBg({ media_url: webpUrl, media_type: 'image' });
        addToast('Gambar background berhasil dikompres ke WebP', 'success');
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === 'string') {
            updateCurrentBg({
              media_url: event.target.result,
              media_type: isVideo ? 'video' : 'gif',
            });
            addToast(`${isVideo ? 'Video' : 'GIF'} background berhasil dimuat`, 'success');
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error('Upload background error:', err);
      addToast(err.message || 'Gagal memproses media background', 'error');
    } finally {
      setIsCompressingBg(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(guestLink);
    addToast('Link tamu disalin ke clipboard!', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Nama user/acara tidak boleh kosong', 'error');
      setActiveTab('info');
      return;
    }
    if (!slug.trim()) {
      addToast('Slug tidak boleh kosong', 'error');
      setActiveTab('info');
      return;
    }
    if (slugError) {
      addToast(slugError, 'error');
      setActiveTab('info');
      return;
    }
    if (!codePrefix.trim() || prefixError) {
      addToast(prefixError || 'Kode prefix tidak valid', 'error');
      setActiveTab('info');
      return;
    }

    setIsSubmitting(true);
    try {
      const eventPayload = {
        name: name.trim(),
        slug: slugify(slug),
        code_prefix: codePrefix.trim().toUpperCase(),
        event_date: eventDate.trim() || '2026',
        couple_names: coupleNames.trim() || name.trim(),
        quote_text: quoteText.trim(),
        quote_source: quoteSource.trim(),
        template_category_id: selectedCategoryId || undefined,
        active_from: activeFrom ? new Date(activeFrom).toISOString() : undefined,
        active_until: activeUntil ? new Date(activeUntil).toISOString() : undefined,
        status: status,
        is_active: status === 'aktif',
      };

      const settingsPayload = {
        retention_hours: retentionHours,
        countdown_seconds: countdownSeconds,
        default_mirror: defaultMirror,
      };

      let result: Event;
      if (eventToEdit) {
        result = await EventService.updateEvent(
          eventToEdit.id,
          eventPayload,
          settingsPayload,
          selectedFilterIds,
          backgrounds
        );
        addToast(`Acara "${result.name}" berhasil diperbarui`, 'success');
      } else {
        result = await EventService.createEvent(
          eventPayload,
          settingsPayload,
          selectedFilterIds,
          backgrounds
        );
        addToast(`Acara baru "${result.name}" berhasil dibuat!`, 'success');
      }

      onSaved(result);
      onClose();
    } catch (err: any) {
      console.error('Submit event error:', err);
      addToast(err.message || 'Gagal menyimpan acara', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border-2 border-black max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h2 className="font-serif font-bold text-lg sm:text-xl text-stone-900 tracking-tight">
              {eventToEdit ? 'Edit User (Acara Pernikahan)' : 'Tambah User (Acara Baru)'}
            </h2>
            <p className="font-sans text-xs text-stone-500">
              {eventToEdit ? `Mengelola acara: ${eventToEdit.name}` : 'Buat link dan QR photobooth khusus untuk acara pernikahan baru'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-stone-300 hover:border-black flex items-center justify-center text-stone-500 hover:text-black cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 5 Tab Navigation */}
        <div className="flex items-center overflow-x-auto border-b border-stone-200 bg-stone-100/70 px-4 sm:px-6 pt-2 space-x-1 sm:space-x-2">
          {[
            { key: 'info', label: '1. Info Acara', icon: Calendar },
            { key: 'template', label: '2. Template & Filter', icon: Layers },
            { key: 'settings', label: '3. Pengaturan Photobooth', icon: Sliders },
            { key: 'background', label: '4. Background Layar', icon: ImageIcon },
            { key: 'qr', label: '5. QR & Link', icon: QrCode },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex items-center space-x-1.5 px-3 py-2.5 rounded-t-xl font-serif text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-stone-950 border-t-2 border-x-2 border-black -mb-[1px] shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: INFO ACARA */}
          {activeTab === 'info' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Nama User & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-serif font-bold text-stone-800 mb-1">
                    Nama User (Acara) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Contoh: Monika & David"
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:bg-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-serif font-bold text-stone-800 mb-1">
                    Status Acara
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:bg-white focus:outline-none font-sans font-semibold"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                    <option value="selesai">Selesai</option>
                  </select>
                </div>
              </div>

              {/* Slug & Code Prefix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border border-stone-300 bg-stone-50/70">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-serif font-bold text-stone-800">
                      Slug Link Tamu <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-stone-500">
                      /e/{slug || '...'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setIsSlugManuallyEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    placeholder="monika-david"
                    className={`w-full px-3 py-2 rounded-xl border-2 font-mono text-xs focus:bg-white focus:outline-none ${
                      slugError
                        ? 'border-rose-500 bg-rose-50'
                        : 'border-black bg-white'
                    }`}
                    required
                  />
                  {slugError && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      {slugError}
                    </p>
                  )}
                  {eventToEdit && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200 mt-1.5 leading-tight flex items-start space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <span>Perhatian: Mengubah slug akan mematikan link dan QR code yang sudah dicetak sebelumnya!</span>
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-serif font-bold text-stone-800">
                      Kode Prefix Foto (Unik Global) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-stone-500">
                      Contoh: {codePrefix || 'MND'}-0001
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    value={codePrefix}
                    onChange={(e) => {
                      setIsPrefixManuallyEdited(true);
                      setCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    }}
                    placeholder="MND"
                    className={`w-full px-3 py-2 rounded-xl border-2 font-mono uppercase text-xs focus:bg-white focus:outline-none tracking-widest ${
                      prefixError
                        ? 'border-rose-500 bg-rose-50'
                        : 'border-black bg-white'
                    }`}
                    required
                  />
                  {prefixError ? (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      {prefixError}
                    </p>
                  ) : (
                    <p className="text-[10px] text-stone-500 mt-1">
                      2-4 huruf kapital unik agar kode foto tamu tidak bentrok dengan acara lain.
                    </p>
                  )}
                </div>
              </div>

              {/* Tanggal & Nama Pasangan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-serif font-bold text-stone-800 mb-1">
                    Tanggal Acara (Teks Tampilan)
                  </label>
                  <input
                    type="text"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    placeholder="Contoh: 15 November 2026"
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-serif font-bold text-stone-800 mb-1">
                    Nama Pasangan (Couple Names)
                  </label>
                  <input
                    type="text"
                    value={coupleNames}
                    onChange={(e) => setCoupleNames(e.target.value)}
                    placeholder="Contoh: Monika & David"
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Kutipan & Sumber */}
              <div className="space-y-2">
                <label className="block text-xs font-serif font-bold text-stone-800">
                  Kutipan Kata &amp; Sumber (Ditampilkan di Layar 1 Tamu)
                </label>
                <textarea
                  rows={2}
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Kutipan cinta atau ayat suci..."
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:bg-white focus:outline-none"
                />
                <input
                  type="text"
                  value={quoteSource}
                  onChange={(e) => setQuoteSource(e.target.value)}
                  placeholder="Sumber kutipan, contoh: QS. Ar-Rum: 21"
                  className="w-full px-3.5 py-1.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:bg-white focus:outline-none"
                />
              </div>

              {/* Masa Aktif Dari & Sampai */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border border-stone-200 bg-stone-50">
                <div>
                  <label className="block text-xs font-serif font-bold text-stone-800 mb-1">
                    Masa Aktif Mulai (Active From)
                  </label>
                  <input
                    type="datetime-local"
                    value={activeFrom}
                    onChange={(e) => setActiveFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-black bg-white text-stone-900 text-xs focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-serif font-bold text-stone-800 mb-1">
                    Masa Aktif Berakhir (Active Until)
                  </label>
                  <input
                    type="datetime-local"
                    value={activeUntil}
                    onChange={(e) => setActiveUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-black bg-white text-stone-900 text-xs focus:outline-none font-mono"
                  />
                </div>
                <p className="sm:col-span-2 text-[10px] text-stone-500">
                  Di luar rentang waktu ini, tamu akan melihat layar pesan bahwa photobooth belum aktif atau sudah berakhir.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TEMPLATE & FILTER */}
          {activeTab === 'template' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Kategori Template */}
              <div className="p-4 rounded-2xl border-2 border-black bg-stone-50 space-y-2">
                <label className="block text-xs font-serif font-bold text-stone-900">
                  Pilih Kategori Template Frame <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-white text-stone-900 text-xs font-serif font-semibold focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500">
                  Tamu hanya dapat memilih desain bingkai foto yang tergabung dalam kategori ini.
                </p>
              </div>

              {/* Filter LUT Aktif */}
              <div className="p-4 rounded-2xl border-2 border-black bg-white space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-stone-200">
                  <div>
                    <h4 className="font-serif font-bold text-xs text-stone-900">
                      Filter Warna yang Diizinkan
                    </h4>
                    <p className="text-[10px] text-stone-500">
                      Centang filter yang boleh digunakan tamu di photobooth ini
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFilterIds(allFilters.map((f) => f.id))}
                      className="text-[10px] font-sans font-bold text-stone-600 hover:text-black underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-stone-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFilterIds([])}
                      className="text-[10px] font-sans font-bold text-stone-600 hover:text-black underline cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {allFilters.map((flt) => {
                    const isChecked = selectedFilterIds.includes(flt.id);
                    return (
                      <label
                        key={flt.id}
                        className={`flex items-center space-x-2 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'border-black bg-stone-100 font-bold'
                            : 'border-stone-200 bg-white text-stone-500 hover:border-stone-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFilterIds([...selectedFilterIds, flt.id]);
                            } else {
                              setSelectedFilterIds(selectedFilterIds.filter((id) => id !== flt.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-2 border-black accent-black cursor-pointer"
                        />
                        <span className="text-xs truncate">{flt.name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-stone-400 font-sans">
                  *Catatan: Kartu "Normal / Asli" akan selalu tersedia di photobooth tamu secara otomatis.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PENGATURAN PHOTOBOOTH */}
          {activeTab === 'settings' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Retention Hours */}
              <div className="p-4 rounded-2xl border-2 border-black bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-serif font-bold text-stone-900">
                    Masa Retensi File Softfile (Jam)
                  </label>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-stone-300">
                    {retentionHours} Jam (~{(retentionHours / 24).toFixed(1)} Hari)
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={retentionHours}
                  onChange={(e) => setRetentionHours(parseInt(e.target.value, 10) || 120)}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-white text-xs font-mono"
                />
                <p className="text-[11px] text-stone-500">
                  Berapa lama softfile foto tamu disimpan sebelum dihapus otomatis (default 120 jam = 5 hari).
                </p>
              </div>

              {/* Countdown Seconds */}
              <div className="p-4 rounded-2xl border-2 border-black bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-serif font-bold text-stone-900">
                    Hitungan Mundur Kamera (Detik)
                  </label>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-stone-300">
                    {countdownSeconds} Detik
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={countdownSeconds}
                  onChange={(e) => setCountdownSeconds(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>2 Detik</span>
                  <span>3 Detik (Rekomendasi)</span>
                  <span>5 Detik</span>
                  <span>10 Detik</span>
                </div>
              </div>

              {/* Default Mirror */}
              <div className="p-4 rounded-2xl border-2 border-black bg-stone-50 flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-bold text-xs text-stone-900">
                    Cermin Kamera Bawaan (Default Mirror)
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Aktifkan jika kamera depan ingin membalik gambar seperti cermin asli
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={defaultMirror}
                    onChange={(e) => setDefaultMirror(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900 border border-stone-300" />
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: BACKGROUND LAYAR */}
          {activeTab === 'background' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Screen Selector Buttons */}
              <div className="flex items-center space-x-1 overflow-x-auto pb-1">
                {[
                  { key: 'landing', label: '1. Landing' },
                  { key: 'howto', label: '2. Cara Gunakan' },
                  { key: 'frame', label: '3. Pilih Frame' },
                  { key: 'camera', label: '4. Kamera' },
                  { key: 'filter', label: '5. Pilih Filter' },
                  { key: 'result', label: '6. Hasil Foto' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveScreenBgKey(s.key as ScreenKey)}
                    className={`px-3 py-1.5 rounded-full text-xs font-serif font-bold transition-all shrink-0 cursor-pointer ${
                      activeScreenBgKey === s.key
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Editor & Preview Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {/* Left 2 Cols: Controls */}
                <div className="md:col-span-2 space-y-4">
                  {/* Upload Media Card */}
                  <div className="p-4 rounded-2xl border-2 border-black bg-stone-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif font-bold text-xs text-stone-900">
                        Media Background Layar "{activeScreenBgKey}"
                      </h4>
                      <span className="font-mono text-[10px] uppercase font-bold text-stone-500 px-2 py-0.5 rounded bg-white border border-stone-300">
                        Tipe: {currentBg.media_type}
                      </span>
                    </div>

                    <input
                      type="file"
                      ref={bgFileInputRef}
                      onChange={handleBgMediaUpload}
                      accept="image/*,video/mp4,video/webm"
                      className="hidden"
                    />

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => bgFileInputRef.current?.click()}
                        disabled={isCompressingBg}
                        className="px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-900 text-xs font-serif font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
                      >
                        {isCompressingBg ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>Upload Gambar / GIF / Video</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleApplyBgToAll}
                        className="px-3.5 py-2 rounded-full border border-stone-300 hover:border-black bg-stone-100 hover:bg-white text-stone-700 hover:text-black text-xs font-sans font-semibold cursor-pointer"
                      >
                        Terapkan ke Semua Layar
                      </button>
                    </div>

                    <p className="text-[10px] text-stone-500 leading-tight">
                      Maksimal: Foto 5MB (otomatis WebP), GIF 10MB, Video 15MB. Rekomendasi portrait 1080x1920 px (9:16).
                    </p>
                  </div>

                  {/* Blur Slider */}
                  <div className="p-4 rounded-2xl border-2 border-black bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-serif font-bold text-stone-900">
                        Efek Blur Background (0 - 20 px)
                      </label>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300">
                        {currentBg.blur_px}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={currentBg.blur_px}
                      onChange={(e) => updateCurrentBg({ blur_px: parseInt(e.target.value, 10) })}
                      className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-black"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                      <span>0px (Jernih)</span>
                      <span>8px (Standar)</span>
                      <span>20px (Sangat Blur)</span>
                    </div>
                  </div>

                  {/* Dark Overlay Slider */}
                  <div className="p-4 rounded-2xl border-2 border-black bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-serif font-bold text-stone-900">
                        Overlay Gelap / Kegelapan (0% - 80%)
                      </label>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300">
                        {Math.round(currentBg.overlay_opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={Math.round(currentBg.overlay_opacity * 100)}
                      onChange={(e) =>
                        updateCurrentBg({ overlay_opacity: parseInt(e.target.value, 10) / 100 })
                      }
                      className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-black"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                      <span>0% (Terang)</span>
                      <span>40%</span>
                      <span>80% (Gelap Elegan)</span>
                    </div>
                  </div>
                </div>

                {/* Right 1 Col: Mobile Frame Live Preview */}
                <div className="flex flex-col items-center">
                  <span className="font-serif font-bold text-xs text-stone-600 mb-2">
                    Preview Layar HP (9:16)
                  </span>

                  <div className="relative w-44 aspect-9/16 rounded-3xl border-4 border-black bg-stone-900 overflow-hidden shadow-xl flex flex-col justify-between p-3 select-none">
                    {/* Background Layer with media, blur, and opacity */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      {currentBg.media_type === 'video' ? (
                        <video
                          src={currentBg.media_url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                          style={{
                            filter: currentBg.blur_px ? `blur(${currentBg.blur_px}px)` : undefined,
                            transform: 'scale(1.08)',
                          }}
                        />
                      ) : (
                        <img
                          src={currentBg.media_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          style={{
                            filter: currentBg.blur_px ? `blur(${currentBg.blur_px}px)` : undefined,
                            transform: 'scale(1.08)',
                          }}
                        />
                      )}
                      {/* Dark overlay */}
                      <div
                        className="absolute inset-0 bg-black pointer-events-none"
                        style={{ opacity: currentBg.overlay_opacity }}
                      />
                    </div>

                    {/* Dummy UI overlay for realism */}
                    <div className="relative z-10 flex justify-between items-center text-white/80 text-[8px] font-mono">
                      <span>{activeScreenBgKey}</span>
                      <span>100%</span>
                    </div>

                    <div className="relative z-10 text-center text-white my-auto p-1">
                      <p className="font-serif text-[10px] font-bold">{name || 'Nama Acara'}</p>
                      <p className="text-[8px] opacity-80 mt-0.5">{coupleNames || 'Pasangan'}</p>
                    </div>

                    <div className="relative z-10 w-full bg-white/20 backdrop-blur-sm rounded-full py-1 text-center text-white text-[8px] font-bold border border-white/30">
                      Tombol Tamu
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: QR DAN LINK */}
          {activeTab === 'qr' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Public Base URL Warning banner if empty */}
              {!appSettings.public_base_url && (
                <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">
                      URL Publik Website belum diatur di Setting &gt; Website Admin
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      QR code dan link saat ini menggunakan host lokal ({window.location.origin}). Untuk acara produksi resmi, isi URL domain di Setting &gt; Website Admin agar link tamu dapat diakses dari internet.
                    </p>
                  </div>
                </div>
              )}

              {/* Guest Link Box */}
              <div className="p-4 rounded-2xl border-2 border-black bg-stone-50 space-y-2">
                <label className="block text-xs font-serif font-bold text-stone-900">
                  Link Publik Photobooth Tamu
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={guestLink}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-black bg-white text-stone-900 font-mono text-xs select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 rounded-xl border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-serif font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </button>
                  <a
                    href={`/e/${slug || 'demo'}?preview=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl border-2 border-black bg-white hover:bg-stone-100 text-stone-800 transition-colors"
                    title="Buka Preview sebagai Tamu"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* QR Code & Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center p-6 rounded-2xl border-2 border-black bg-white">
                <div className="flex flex-col items-center">
                  <div className="w-48 h-48 rounded-2xl border-2 border-black p-2 bg-stone-50 flex items-center justify-center shadow-md">
                    {qrPngUrl ? (
                      <img src={qrPngUrl} alt="QR Code Tamu" className="w-full h-full object-contain" />
                    ) : (
                      <QrCode className="w-12 h-12 text-stone-400 animate-pulse" />
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-stone-500 mt-2">
                    QR Versi M (Error Correction 15%)
                  </span>
                </div>

                <div className="space-y-3 text-center sm:text-left">
                  <h4 className="font-serif font-bold text-base text-stone-950">
                    Cetak &amp; Bagikan QR Code
                  </h4>
                  <p className="text-xs text-stone-600 font-sans leading-relaxed">
                    Tamu dapat langsung memindai QR code ini di tempat resepsi pernikahan untuk memulai sesi foto tanpa menginstal aplikasi apapun.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={() => setShowPosterModal(true)}
                      className="px-5 py-2.5 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white font-serif font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Cetak Poster QR (A4/A5)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!qrPngUrl) return;
                        const a = document.createElement('a');
                        a.href = qrPngUrl;
                        a.download = `QR_${slug || 'wedding'}.png`;
                        a.click();
                        addToast('QR PNG berhasil diunduh', 'success');
                      }}
                      className="px-4 py-2 rounded-full border border-stone-300 hover:border-black font-sans text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                    >
                      Unduh PNG
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!qrSvgString) return;
                        const blob = new Blob([qrSvgString], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `QR_${slug || 'wedding'}.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                        addToast('QR SVG berhasil diunduh', 'success');
                      }}
                      className="px-4 py-2 rounded-full border border-stone-300 hover:border-black font-sans text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                    >
                      Unduh SVG
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between bg-white">
            <div className="text-[11px] text-stone-500 font-sans">
              Tab aktif: <span className="font-semibold">{activeTab}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-stone-300 hover:border-black font-sans text-xs font-bold text-stone-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white font-sans text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{eventToEdit ? 'Simpan Perubahan' : 'Buat User Acara'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Poster QR Modal */}
      {showPosterModal && (
        <QrPosterModal
          isOpen={showPosterModal}
          event={{
            id: eventToEdit?.id || 'temp',
            name: name || 'Wedding Party',
            slug: slug || 'wedding',
            code_prefix: codePrefix || 'WED',
            event_date: eventDate || '2026',
            couple_names: coupleNames || name,
            quote_text: quoteText,
            quote_source: quoteSource,
            status: status,
            is_active: status === 'aktif',
          }}
          appSettings={appSettings}
          guestUrl={guestLink}
          onClose={() => setShowPosterModal(false)}
        />
      )}
    </div>
  );
};

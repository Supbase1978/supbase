import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "./cx";
import { ProductImage, type ProductImageFrame } from "./ProductImage";

export interface GalleryImage {
  url: string;
  alt: string;
}

export interface ProductGalleryProps {
  /** A borító — ez látszik zárt állapotban, és ez a galéria ELSŐ képe. */
  cover: string | null;
  /** További képek, megjelenítési sorrendben. Üres = egy képes termék. */
  images: readonly string[];
  /** A terméknév: az alt-szövegek és a párbeszédablak neve ebből épül. */
  modelName: string;
  frame?: ProductImageFrame;
  /** Kép hiányában megjelenő tartalom (a modul saját placeholderje). */
  fallback?: React.ReactNode;
  /** Feliratok — a hívó i18n-ből adja, itt hardcode-olt szöveg nincs. */
  labels: {
    /** A nagyítást indító gomb neve, pl. „Kép nagyítása". */
    open: string;
    close: string;
    previous: string;
    next: string;
    /** `{{current}}` / `{{total}}` helyőrzőkkel, pl. „3. kép a 6-ból". */
    position: string;
  };
  className?: string;
}

/** A szélső sáv, ahol a vízszintes húzás a RENDSZERÉ (iOS/Android vissza-gesztus). */
const EDGE_GUARD_PX = 24;
/** Ennél rövidebb húzás nem lapoz — véletlen elmozdulás is ennyi. */
const SWIPE_THRESHOLD_PX = 44;

/**
 * Termékkép teljes képernyős nézettel (F2.1-utó-30).
 *
 * MIÉRT: a telefonos lista KÉTOSZLOPOS, tehát a kártya-kép kicsi (~170 px) —
 * ez az ára annak, hogy két deszka egymás MELLETT látszik és összevethető. A
 * részletet (orr-forma, fedélzet-rajz, varrás) ez a nézet adja vissza, de csak
 * akkor, ha a felhasználó kéri: a nagy képek SOHA nem töltődnek a listával.
 *
 * Amit a felület tud, és miért pont így:
 *  * **Bezárás négyféleképp**: ×, `Esc`, háttérre koppintás, és magára a képre
 *    koppintás. A koppintás önmagában NEM lenne elég: billentyűzettel vagy
 *    képernyőolvasóval nem lehet „koppintani".
 *  * **Váltás háromféleképp**: legyintés, nyilak (egér/érintés), nyíl-billentyűk.
 *    A legyintés a leggyorsabb, de láthatatlan — ezért sosem az EGYETLEN mód.
 *  * **A legyintés kihagyja a képernyő szélső sávját** (`EDGE_GUARD_PX`): ott a
 *    vízszintes húzás iOS-en és Androidon a rendszer vissza-gesztusa.
 *  * **Pöttysor**: egyszerre affordancia és állapot — enélkül semmi nem árulná
 *    el, hogy egynél több kép van.
 *  * **Egy képnél** nincs pöttysor, nincs legyintés, nincs nyíl: csak nagyítás
 *    és bezárás. A HTML-forrásokból (Aqua Marina, Indiana) egyelőre egy kép jön,
 *    ez a normál eset, nem hibaállapot.
 *  * **Csak a SZOMSZÉD képet tölti előre** (n±1), nem mind a hatot.
 */
export function ProductGallery({
  cover,
  images,
  modelName,
  frame = "hero",
  fallback,
  labels,
  className,
}: ProductGalleryProps) {
  const all = cover === null ? [...images] : [cover, ...images];
  const [openAt, setOpenAt] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const isOpen = openAt !== null;
  const total = all.length;
  const canBrowse = total > 1;

  const close = useCallback(() => setOpenAt(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenAt((at) => (at === null ? at : (at + delta + total) % total)),
    [total],
  );

  // A natív `<dialog>` adja a fókusz-csapdát és a háttér inertté tételét —
  // ezt kézzel újraépíteni felesleges és hibázni is könnyebb benne.
  //
  // A párbeszédablak CSAK NYITOTT állapotban létezik a DOM-ban. Ez nem
  // takarékosság: egy zárt `<dialog>` `display:none`, de a benne lévő `<img>`
  // letöltését a böngészők nem egységesen hagyják ki — így viszont garantáltan
  // egyetlen nagy kép sem tölt le, amíg a felhasználó nem kéri.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || dialog.open) return;
    dialog.showModal();
    closeRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (!canBrowse) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, canBrowse, step]);

  if (total === 0) {
    return (
      <ProductImage
        src={null}
        alt={modelName}
        frame={frame}
        fallback={fallback}
        className={className}
      />
    );
  }

  const current = openAt ?? 0;
  const positionLabel = labels.position
    .replace("{{current}}", String(current + 1))
    .replace("{{total}}", String(total));
  // Csak a szomszédos képet tartjuk a DOM-ban — a többi nem tölt le.
  const mounted = canBrowse
    ? [(current - 1 + total) % total, current, (current + 1) % total]
    : [current];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenAt(0)}
        aria-label={labels.open}
        className={cx(
          "block w-full cursor-zoom-in rounded-[var(--radius-card)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--petrol)]",
          className,
        )}
      >
        <ProductImage
          src={all[0] ?? null}
          alt={modelName}
          frame={frame}
          fallback={fallback}
        />
      </button>

      {isOpen ? (
        <dialog
          ref={dialogRef}
          aria-label={modelName}
          onClose={close}
          onCancel={close}
          // Háttérre koppintás: a `<dialog>` maga a háttér, a tartalom külön elem.
          onClick={(event) => {
            if (event.target === dialogRef.current) close();
          }}
          className="m-0 h-full max-h-none w-full max-w-none bg-[var(--ink-deep)] p-0 backdrop:bg-black/70"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm font-semibold text-white/90">
                {canBrowse ? positionLabel : modelName}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={labels.close}
                className="flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                ×
              </button>
            </div>

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center"
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (!touch) return;
                // A képernyő SZÉLÉRŐL induló húzás a rendszeré (vissza-gesztus) —
                // abba nem szólunk bele.
                const width = window.innerWidth;
                if (
                  touch.clientX < EDGE_GUARD_PX ||
                  touch.clientX > width - EDGE_GUARD_PX
                ) {
                  touchStart.current = null;
                  return;
                }
                touchStart.current = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchEnd={(event) => {
                const start = touchStart.current;
                touchStart.current = null;
                if (!start || !canBrowse) return;
                const touch = event.changedTouches[0];
                if (!touch) return;
                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;
                // Csak a VÍZSZINTES szándékot fogadjuk el lapozásnak.
                if (
                  Math.abs(dx) < SWIPE_THRESHOLD_PX ||
                  Math.abs(dx) <= Math.abs(dy)
                )
                  return;
                step(dx < 0 ? 1 : -1);
              }}
            >
              {mounted.map((index) => (
                <img
                  key={all[index]}
                  src={all[index]}
                  alt={`${modelName} — ${index + 1}`}
                  className={cx(
                    "max-h-full max-w-full cursor-zoom-out object-contain",
                    index === current ? "" : "hidden",
                  )}
                  onClick={close}
                />
              ))}

              {canBrowse ? (
                <>
                  <GalleryStep
                    side="left"
                    label={labels.previous}
                    onClick={() => step(-1)}
                  />
                  <GalleryStep
                    side="right"
                    label={labels.next}
                    onClick={() => step(1)}
                  />
                </>
              ) : null}
            </div>

            {canBrowse ? (
              <div
                className="flex justify-center gap-2 py-4"
                aria-hidden="true"
              >
                {all.map((url, index) => (
                  <span
                    key={url}
                    className={cx(
                      "h-2 w-2 rounded-full transition-opacity",
                      index === current ? "bg-white" : "bg-white/40",
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}

function GalleryStep({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center",
        "rounded-full bg-black/40 text-xl leading-none text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

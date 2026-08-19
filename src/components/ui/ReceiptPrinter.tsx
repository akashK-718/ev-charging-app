"use client";

import { CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  useContext,
} from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReceiptPrinterStage = "processing" | "printing" | "complete";
export type ReceiptFeedMotion = "smooth" | "stepped";

export type ReceiptPrinterRootProps = Omit<
  ComponentPropsWithoutRef<"section">,
  "children"
> & {
  animate?: boolean;
  children: ReactNode;
  feedMotion?: ReceiptFeedMotion;
  stage: ReceiptPrinterStage;
};

export type ReceiptPrinterMachineProps = ComponentPropsWithoutRef<"div">;
export type ReceiptPrinterHeaderProps = ComponentPropsWithoutRef<"div">;
export type ReceiptPrinterScreenProps = ComponentPropsWithoutRef<"div">;
export type ReceiptPrinterOutputProps = ComponentPropsWithoutRef<"div">;
export type ReceiptPrinterPaperProps = ComponentPropsWithoutRef<"article">;
export type ReceiptPrinterStatusProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  children?: ReactNode;
};

// ── Context ───────────────────────────────────────────────────────────────────

type ReceiptPrinterContextValue = {
  animate: boolean;
  feedMotion: ReceiptFeedMotion;
  shouldMove: boolean;
  stage: ReceiptPrinterStage;
};

const ReceiptPrinterContext = createContext<ReceiptPrinterContextValue | null>(null);

function useReceiptPrinter(component: string) {
  const context = useContext(ReceiptPrinterContext);
  if (!context) throw new Error(`${component} must be used inside ReceiptPrinter.Root.`);
  return context;
}

// ── Easing curves ─────────────────────────────────────────────────────────────

const easeOut  = [0.23, 1, 0.32, 1] as const;
const easeInOut = [0.77, 0, 0.175, 1] as const;

// ── Torn-paper clip-path (serrated bottom edge) ───────────────────────────────

const receiptToothCount = 40;
const receiptToothDepth = 4;
const receiptToothPoints = Array.from(
  { length: receiptToothCount * 2 },
  (_, i) => {
    const x = 100 - ((i + 1) * 100) / (receiptToothCount * 2);
    const y = i % 2 === 0 ? "100%" : `calc(100% - ${receiptToothDepth}px)`;
    return `${x}% ${y}`;
  },
).join(", ");
const receiptClipPath = `polygon(0 0, 100% 0, 100% calc(100% - ${receiptToothDepth}px), ${receiptToothPoints})`;

// ── Stepped paper-feed keyframes ──────────────────────────────────────────────

const printingTransformKeyframes = [
  "translateY(calc(-100% + 2px))",
  "translateY(-91%)", "translateY(-91%)",
  "translateY(-81%)", "translateY(-81%)",
  "translateY(-70%)", "translateY(-70%)",
  "translateY(-58%)", "translateY(-58%)",
  "translateY(-45%)", "translateY(-45%)",
  "translateY(-32%)", "translateY(-32%)",
  "translateY(-20%)", "translateY(-20%)",
  "translateY(-10%)", "translateY(-10%)",
  "translateY(-3%)",  "translateY(-3%)",
  "translateY(0%)",
];

const printingKeyframeTimes = [
  0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42,
  0.495, 0.525, 0.6, 0.63, 0.705, 0.735, 0.81, 0.84, 0.915, 0.945, 1,
];

// ── Status labels ─────────────────────────────────────────────────────────────

const statusLabels: Record<ReceiptPrinterStage, ReactNode> = {
  processing: "Fetching your receipt…",
  printing:   "Printing receipt",
  complete:   "Receipt ready",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ReceiptPrinterRoot({
  "aria-label": ariaLabel = "Receipt printer",
  animate = true,
  children,
  className,
  feedMotion = "stepped",
  stage,
  ...props
}: ReceiptPrinterRootProps) {
  const shouldReduceMotion = useReducedMotion();
  const context: ReceiptPrinterContextValue = {
    animate,
    feedMotion,
    shouldMove: animate && !shouldReduceMotion,
    stage,
  };

  return (
    <ReceiptPrinterContext.Provider value={context}>
      <section
        aria-label={ariaLabel}
        className={cn("relative isolate flex w-full max-w-sm flex-col items-center", className)}
        data-stage={stage}
        {...props}
      >
        {children}
      </section>
    </ReceiptPrinterContext.Provider>
  );
}

function ReceiptPrinterMachine({ children, className, ...props }: ReceiptPrinterMachineProps) {
  return (
    <div
      className={cn(
        // Printer body — deliberate skeuomorphic departure from Kirin's restrained design system
        "relative isolate w-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-700 p-3 pb-8",
        "shadow-[0_20px_36px_-20px_rgba(0,0,0,0.55),0_6px_14px_-8px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.4)]",
        // Plastic noise texture overlay
        "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:bg-[url('/textures/plastic-noise.svg')] before:bg-[length:180px_180px] before:bg-repeat before:opacity-20 before:mix-blend-multiply before:content-['']",
        className,
      )}
      {...props}
    >
      {children}
      {/* Paper-slot slit at the bottom */}
      <div
        aria-hidden="true"
        className="absolute inset-x-6 bottom-3 z-40 h-2 rounded-[0.25rem] border border-zinc-900 bg-zinc-900 shadow-inner shadow-zinc-950"
      />
    </div>
  );
}

function ReceiptPrinterHeader({ children, className, ...props }: ReceiptPrinterHeaderProps) {
  return (
    <div
      className={cn("relative z-10 flex h-11 items-start justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function ReceiptPrinterScreen({ children, className, ...props }: ReceiptPrinterScreenProps) {
  return (
    <div
      className={cn(
        "relative z-10 isolate overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900 p-4 text-white",
        "shadow-inner shadow-zinc-950/80",
        "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:shadow-[inset_0_0_24px_4px_rgba(0,0,0,0.45)] after:content-['']",
        className,
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function StatusIndicator({ animate, move, stage }: { animate: boolean; move: boolean; stage: ReceiptPrinterStage }) {
  const isComplete = stage === "complete";

  return (
    <span aria-hidden="true" className="relative grid size-5 shrink-0 place-items-center">
      <AnimatePresence initial={false} mode="sync">
        {isComplete ? (
          <motion.span
            animate={{ opacity: 1, transform: "scale(1)" }}
            className="col-start-1 row-start-1 grid place-items-center text-green-400"
            exit={{ opacity: animate ? 0 : 1, transform: move ? "scale(0.96)" : "scale(1)" }}
            initial={{ opacity: animate ? 0 : 1, transform: move ? "scale(0.94)" : "scale(1)" }}
            key="complete"
            transition={{ duration: animate ? 0.16 : 0, ease: easeOut }}
          >
            <CheckCircle size={18} weight="fill" />
          </motion.span>
        ) : (
          <motion.span
            animate={{ opacity: 1, transform: "scale(1)" }}
            className="col-start-1 row-start-1 grid place-items-center text-zinc-400"
            exit={{ opacity: animate ? 0 : 1, transform: move ? "scale(0.96)" : "scale(1)" }}
            initial={{ opacity: animate ? 0 : 1, transform: move ? "scale(0.94)" : "scale(1)" }}
            key="working"
            transition={{ duration: animate ? 0.16 : 0, ease: easeOut }}
          >
            <CircleNotch
              className={cn(animate && "animate-spin motion-reduce:animate-none")}
              size={18}
              weight="bold"
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function ReceiptPrinterStatus({ children, className, ...props }: ReceiptPrinterStatusProps) {
  const { animate, shouldMove, stage } = useReceiptPrinter("ReceiptPrinter.Status");

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)} {...props}>
      <StatusIndicator animate={animate} move={shouldMove} stage={stage} />
      <div aria-live="polite" className="grid min-w-0 flex-1 items-center" role="status">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            className="col-start-1 row-start-1 truncate font-medium text-zinc-400 text-xs leading-none"
            exit={{ opacity: animate ? 0 : 1, transform: shouldMove ? "translateY(-4px)" : "translateY(0px)" }}
            initial={{ opacity: animate ? 0 : 1, transform: shouldMove ? "translateY(4px)" : "translateY(0px)" }}
            key={stage}
            transition={{ duration: animate ? 0.18 : 0, ease: easeOut }}
          >
            {children ?? statusLabels[stage]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReceiptPrinterPaper({ children, className, style, ...props }: ReceiptPrinterPaperProps) {
  return (
    <article
      className={cn(
        "relative z-10 min-h-80 bg-[#faf8f5] bg-[url('/textures/receipt-paper.svg')] bg-cover px-6 pt-7 pb-8 font-mono text-zinc-900 bg-blend-soft-light",
        className,
      )}
      style={{ clipPath: receiptClipPath, ...style }}
      {...props}
    >
      {children}
    </article>
  );
}

function ReceiptPrinterOutput({ children, className, ...props }: ReceiptPrinterOutputProps) {
  const { animate, feedMotion, shouldMove, stage } = useReceiptPrinter("ReceiptPrinter.Output");
  const isReceiptVisible = stage !== "processing";
  const shouldUseSteppedFeed = feedMotion === "stepped" && stage === "printing" && shouldMove;

  return (
    <div
      className={cn(
        "relative z-50 -mt-4 h-[32rem] w-[calc(80%+3rem)] max-w-full overflow-hidden px-6",
        className,
      )}
      {...props}
    >
      {isReceiptVisible && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 -top-1 z-20 h-2 bg-zinc-900/75 blur-[6px]"
        />
      )}

      <motion.div
        animate={{
          opacity: isReceiptVisible ? 1 : 0,
          transform:
            stage === "printing" && shouldMove
              ? shouldUseSteppedFeed
                ? printingTransformKeyframes
                : "translateY(0%)"
              : isReceiptVisible || !shouldMove
                ? "translateY(0%)"
                : "translateY(calc(-100% + 2px))",
        }}
        aria-hidden={stage !== "complete"}
        className="relative isolate before:pointer-events-none before:absolute before:inset-x-3 before:top-3 before:bottom-4 before:z-0 before:rounded-sm before:shadow-[0_8px_24px_rgba(0,0,0,0.2)] before:content-[''] after:pointer-events-none after:absolute after:right-[8%] after:bottom-0 after:left-[8%] after:z-0 after:h-3 after:translate-y-1.5 after:rounded-full after:bg-black/10 after:blur-lg after:content-['']"
        initial={false}
        transition={{
          opacity: { duration: animate ? 0.16 : 0, ease: easeOut },
          transform: {
            duration: shouldMove ? 1.75 : 0,
            ease: shouldUseSteppedFeed ? "linear" : easeInOut,
            times: shouldUseSteppedFeed ? printingKeyframeTimes : undefined,
          },
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export const ReceiptPrinter = {
  Header:  ReceiptPrinterHeader,
  Machine: ReceiptPrinterMachine,
  Output:  ReceiptPrinterOutput,
  Paper:   ReceiptPrinterPaper,
  Root:    ReceiptPrinterRoot,
  Screen:  ReceiptPrinterScreen,
  Status:  ReceiptPrinterStatus,
};

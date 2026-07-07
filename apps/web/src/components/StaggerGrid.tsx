"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const container: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

interface StaggerGridProps {
  children: ReactNode;
  className?: string;
  /**
   * When to run the entrance animation:
   *   - "in-view" (default): animate once when scrolled into view.
   *   - "mount": animate to "show" on mount and keep that target active.
   *
   * Use "mount" for lists that grow (e.g. "load more"): a one-shot
   * `whileInView` latches after the first reveal, so children appended
   * later stay stuck in the hidden (opacity 0) state. A persistent
   * `animate` target lets late-mounted children animate in too.
   */
  trigger?: "in-view" | "mount";
}

/**
 * Wraps a grid of children and applies a staggered fade-up
 * entrance animation.
 */
export function StaggerGrid({ children, className, trigger = "in-view" }: StaggerGridProps) {
  const triggerProps =
    trigger === "mount"
      ? { animate: "show" as const }
      : { whileInView: "show" as const, viewport: { once: true, margin: "-40px" } };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={container} initial="hidden" {...triggerProps} className={className}>
        {children}
      </motion.div>
    </MotionConfig>
  );
}

/**
 * Wrap individual items inside a StaggerGrid.
 */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

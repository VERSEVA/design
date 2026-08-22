/**
 * @verseva/design · Tailwind v3 preset (legacy consumers).
 * v4 projects use tailwind.css instead. Maps role names to the custom
 * properties defined by tokens.css; import tokens.css in the app's global
 * stylesheet so the variables exist at runtime.
 *
 *   // tailwind.config.js
 *   module.exports = { presets: [require('@verseva/design/preset')] }
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'hairline-soft': 'var(--hairline-soft)',
        hairline: 'var(--hairline)',
        'hairline-strong': 'var(--hairline-strong)',
        'text-1': 'var(--text-1)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-ink': 'var(--accent-ink)',
        focus: 'var(--focus)',
        'accent-2': 'var(--accent-2)',
        highlight: 'var(--highlight)',
        success: 'var(--success)',
        'success-bg': 'var(--success-bg)',
        warn: 'var(--warn)',
        'warn-bg': 'var(--warn-bg)',
        danger: 'var(--danger)',
        'danger-bg': 'var(--danger-bg)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        pill: 'var(--r-pill)',
        btn: 'var(--r-btn)',
      },
      boxShadow: {
        1: 'var(--e-1)',
        2: 'var(--e-2)',
        3: 'var(--e-3)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        emph: 'var(--ease-emph)',
        spring: 'var(--ease-spring)',
        entrance: 'var(--ease-entrance)',
      },
      transitionDuration: {
        1: 'var(--dur-1)',
        2: 'var(--dur-2)',
        3: 'var(--dur-3)',
        4: 'var(--dur-4)',
      },
      maxWidth: {
        prose: 'var(--container-prose)',
        content: 'var(--container-content)',
        wide: 'var(--container-wide)',
      },
    },
  },
};

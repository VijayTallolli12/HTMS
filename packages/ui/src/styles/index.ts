// SCSS style references — import these in the application's styles.css
// These files provide shared CSS custom properties and component styles
// that eliminate duplicated patterns across feature components.
//
// Usage in styles.css:
// @use '@hms/ui/styles';
//
// The actual CSS is compiled by Angular's build pipeline from the SCSS files.

export const STYLE_MODULES = {
  variables: 'styles/_variables.scss',
  base: 'styles/_base.scss',
  layout: 'styles/_layout.scss',
  components: 'styles/_components.scss',
  mixins: 'styles/_mixins.scss',
} as const;

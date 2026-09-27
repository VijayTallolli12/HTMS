import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marks developer-authored inline SVG icon markup as trusted HTML so it can be
 * bound via [innerHTML]. Angular's built-in sanitizer strips <svg> elements,
 * so icon strings defined in component source need this bypass.
 *
 * Only use with static, code-owned strings (icon libraries defined in TS) —
 * never with user-supplied content.
 */
@Pipe({
  name: 'safeSvg',
  standalone: true,
})
export class SafeSvgPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value ?? '');
  }
}

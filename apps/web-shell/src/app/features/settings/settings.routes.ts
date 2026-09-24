import { Routes } from '@angular/router';
import { SettingsWorkspaceComponent } from './settings-workspace.component';
import { AppearanceOverviewComponent } from './pages/appearance-overview.component';
import { AppearanceThemesComponent } from './pages/appearance-themes.component';
import { AppearanceColorsComponent } from './pages/appearance-colors.component';
import { AppearanceTypographyComponent } from './pages/appearance-typography.component';
import { AppearanceMotionComponent } from './pages/appearance-motion.component';
import { AppearanceLayoutComponent } from './pages/appearance-layout.component';
import { AppearanceBrandingComponent } from './pages/appearance-branding.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsWorkspaceComponent,
    children: [
      {
        path: '',
        component: AppearanceOverviewComponent,
        title: 'Settings Overview',
      },
      {
        path: 'themes',
        component: AppearanceThemesComponent,
        title: 'Theme Presets',
      },
      {
        path: 'colors',
        component: AppearanceColorsComponent,
        title: 'Color Tokens',
      },
      {
        path: 'typography',
        component: AppearanceTypographyComponent,
        title: 'Typography Studio',
      },
      {
        path: 'motion',
        component: AppearanceMotionComponent,
        title: 'Motion Kinetics',
      },
      {
        path: 'layout',
        component: AppearanceLayoutComponent,
        title: 'Density & Geometry',
      },
      {
        path: 'branding',
        component: AppearanceBrandingComponent,
        title: 'Application Branding',
      },
    ],
  },
];


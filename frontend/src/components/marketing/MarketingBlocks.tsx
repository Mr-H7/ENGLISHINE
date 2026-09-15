import type { ComponentProps, ReactNode } from 'react';
import { classes } from '@/utils/classes';

export function Hero(props: ComponentProps<'header'>) {
  return (
    <header {...props} className={classes('page-hero', props.className)} />
  );
}
export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="section-head">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
export function FeatureGrid(props: ComponentProps<'div'>) {
  return <div {...props} className={classes('grid grid-3', props.className)} />;
}
export function CourseCard(props: ComponentProps<'article'>) {
  return (
    <article {...props} className={classes('course-card', props.className)} />
  );
}
export function TeacherCard(props: ComponentProps<'article'>) {
  return (
    <article {...props} className={classes('teacher-card', props.className)} />
  );
}
export function CTABanner(props: ComponentProps<'section'>) {
  return (
    <section
      {...props}
      className={classes('home-final-cta', props.className)}
    />
  );
}
export function Statistics(props: ComponentProps<'dl'>) {
  return <dl {...props} className={classes('stat-grid', props.className)} />;
}
export function FAQ(props: ComponentProps<'section'>) {
  return (
    <section {...props} className={classes('faq-section', props.className)} />
  );
}
export function Testimonials(props: ComponentProps<'section'>) {
  return (
    <section
      {...props}
      className={classes('testimonials-section', props.className)}
    />
  );
}
export function Timeline(props: ComponentProps<'ol'>) {
  return <ol {...props} className={classes('timeline', props.className)} />;
}

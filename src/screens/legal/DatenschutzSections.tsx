/**
 * DatenschutzSections - Reusable section components for Datenschutz page
 *
 * Extracted from DatenschutzScreen to improve maintainability.
 * Each section is a self-contained component.
 */

import { type ReactNode } from 'react';
import { sectionStyles } from './legalStyles';

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  number: number;
  children: ReactNode;
}

export function Section({ title, number, children }: SectionProps) {
  return (
    <section style={sectionStyles.section} data-testid={`datenschutz-section-${number}`}>
      <h2 style={sectionStyles.h2}>{number}. {title}</h2>
      {children}
    </section>
  );
}

interface SubsectionProps {
  title: string;
  children: ReactNode;
}

export function Subsection({ title, children }: SubsectionProps) {
  return (
    <>
      <h3 style={sectionStyles.h3}>{title}</h3>
      {children}
    </>
  );
}

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
}

export function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={sectionStyles.link}
      data-testid="external-link"
    >
      {children}
    </a>
  );
}

interface DataTableProps {
  headers: string[];
  rows: (string | ReactNode)[][];
}

export function DataTable({ headers, rows }: DataTableProps) {
  return (
    <table style={sectionStyles.table}>
      <thead>
        <tr>
          {headers.map((header, i) => (
            <th key={i} style={sectionStyles.th}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={sectionStyles.td}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface BulletListProps {
  items: (string | ReactNode)[];
}

export function BulletList({ items }: BulletListProps) {
  return (
    <ul style={sectionStyles.list}>
      {items.map((item, i) => (
        <li key={i} style={sectionStyles.listItem}>{item}</li>
      ))}
    </ul>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <p style={sectionStyles.paragraph}>{children}</p>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <span style={sectionStyles.strong}>{children}</span>;
}

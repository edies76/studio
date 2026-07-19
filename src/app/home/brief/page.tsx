'use client';

import BriefPage from '../../brief/page';
import styles from './brief.module.css';

/** Canonical brief workflow, deliberately nested under the document library. */
export default function HomeBriefPage() {
  return (
    <div className={styles.scope}>
      <BriefPage />
    </div>
  );
}

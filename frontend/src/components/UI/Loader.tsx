import styles from './Loader.module.css';

export function Loader() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.dice}>
        <div className={styles.face}>⚀</div>
        <div className={styles.face}>⚁</div>
        <div className={styles.face}>⚂</div>
        <div className={styles.face}>⚃</div>
        <div className={styles.face}>⚄</div>
        <div className={styles.face}>⚅</div>
      </div>
      <p className={styles.text}>Loading...</p>
    </div>
  );
}
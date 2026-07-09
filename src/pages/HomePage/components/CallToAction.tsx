import { Link } from 'react-router-dom'
import styles from './callToAction.module.css'

export default function CallToAction() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.box}>
          <div>
            <div className={styles.title}>¿Listo para publicar?</div>
            <div className={styles.desc}>
              Arma tu primera pieza y descárgala lista para Instagram, Facebook o WhatsApp.
            </div>
          </div>
          <Link className={styles.link} to="/generador/noticia">
            Abrir generador
          </Link>
        </div>
      </div>
    </section>
  )
}

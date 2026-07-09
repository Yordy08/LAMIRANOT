import styles from './features.module.css'

const items = [
  {
    title: 'Edición en tiempo real',
    description:
      'Cambia categoría, titular e imagen y ve el resultado al instante. Sin botón de actualizar.',
  },
  {
    title: 'Varios formatos',
    description:
      'Post, Reels y Video con plantillas listas para publicar.',
  },
  {
    title: 'Exporta en alta calidad',
    description:
      'Descarga PNG o video a resolución nativa, listo para publicar.',
  },
  {
    title: 'Imagen movible',
    description:
      'Arrastra la foto o video en la vista previa para ajustar el encuadre.',
  },
]

export default function Features() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.h2}>¿Qué puedes hacer?</h2>
        <div className={styles.grid}>
          {items.map((it) => (
            <div key={it.title} className={styles.card}>
              <div className={styles.cardTitle}>{it.title}</div>
              <div className={styles.cardDesc}>{it.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

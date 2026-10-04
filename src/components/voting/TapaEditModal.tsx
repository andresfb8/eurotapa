import { useState, ChangeEvent } from 'react';
import { Member, Team } from '../../types/contest';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { compressImage } from '../../utils/imageCompressor';

interface TapaEditModalProps {
  team: Team;
  members: Member[];
  onSave: (updated: Team) => void;
  onClose: () => void;
}

export function TapaEditModal({ team, members, onSave, onClose }: TapaEditModalProps) {
  const [dishName, setDishName] = useState(team.dishName);
  const [description, setDescription] = useState(team.description);
  const [ingredientsText, setIngredientsText] = useState(team.ingredients.join(', '));
  const [photoUrl, setPhotoUrl] = useState(team.photoUrl || '');
  const [isCompressing, setIsCompressing] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedDataUrl = await compressImage(file);
      setPhotoUrl(compressedDataUrl);
    } catch (err) {
      alert('Error al procesar la fotografía.');
      console.error(err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedIngredients = ingredientsText
      .split(',')
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    onSave({
      ...team,
      dishName: dishName.trim(),
      description: description.trim(),
      ingredients: updatedIngredients,
      photoUrl
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <span className="badge badge-neutral">Equipo: {teamLabel(team, members)}</span>
            <h2 style={{ marginTop: '4px', fontSize: '1.4rem' }}>Ficha de vuestra Tapa</h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Cualquiera de los {membersOfTeam(team.id, members).length === 1 ? 'participantes' : 'miembros del equipo'} ({teamLabel(team, members)}) puede completar o corregir esta ficha.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Nombre de la Tapa
            </label>
            <input
              type="text"
              className="input"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="Ej: Bao de Carrillera al Vino Tinto"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Fotografía de la Tapa
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt="Vista previa"
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              )}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {isCompressing ? 'Optimizando foto...' : 'Subir o Hacer Foto'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Se comprime automáticamente en tu móvil para carga ultrarrápida.
            </span>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Ingredientes Clave (separados por coma)
            </label>
            <input
              type="text"
              className="input"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="Carrillera, Cebolla morada, Reducción de vino..."
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Descripción / Elaboración
            </label>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explica cómo la habéis preparado, técnicas especiales o sugerencia de maridaje..."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isCompressing}>
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus, Users, MapPin, Package, Loader2, Search } from 'lucide-react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useAlert } from '../GlobalAlert';
import { Character, Scene, Prop } from '../../types';
import { convertImageToBase64 } from '../../services/storageService';
import AssetLibraryEditorCard, { LibraryAsset, LibraryAssetType } from './AssetLibraryEditorCard';

const TABS: Array<{ key: LibraryAssetType; label: string }> = [
  { key: 'character', label: '角色库' },
  { key: 'scene', label: '场景库' },
  { key: 'prop', label: '道具库' },
];

const isValidTab = (value: string | null): value is LibraryAssetType =>
  value === 'character' || value === 'scene' || value === 'prop';

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const CharacterLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showAlert } = useAlert();
  const {
    project,
    loading,
    allEpisodes,
    addCharacterToLibrary,
    updateCharacterInLibrary,
    removeCharacterFromLibrary,
    addSceneToLibrary,
    updateSceneInLibrary,
    removeSceneFromLibrary,
    addPropToLibrary,
    updatePropInLibrary,
    removePropFromLibrary,
  } = useProjectContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LibraryAssetType>('character');
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [newCharacterForm, setNewCharacterForm] = useState({ name: '', gender: '', age: '', personality: '' });
  const [newSceneForm, setNewSceneForm] = useState({ location: '', time: '', atmosphere: '' });
  const [newPropForm, setNewPropForm] = useState({ name: '', category: '', description: '' });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isValidTab(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (loading || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
      </div>
    );
  }

  const characters = project.characterLibrary || [];
  const scenes = project.sceneLibrary || [];
  const props = project.propLibrary || [];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCharacters = useMemo(
    () =>
      normalizedQuery
        ? characters.filter((char) =>
            [char.name, char.gender, char.age, char.personality, char.visualPrompt || '', char.coreFeatures || '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : characters,
    [characters, normalizedQuery]
  );

  const filteredScenes = useMemo(
    () =>
      normalizedQuery
        ? scenes.filter((scene) =>
            [scene.location, scene.time, scene.atmosphere, scene.visualPrompt || '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : scenes,
    [scenes, normalizedQuery]
  );

  const filteredProps = useMemo(
    () =>
      normalizedQuery
        ? props.filter((prop) =>
            [prop.name, prop.category, prop.description, prop.visualPrompt || '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : props,
    [props, normalizedQuery]
  );

  const getCharacterRefCount = (characterId: string): number =>
    allEpisodes.filter((ep) => ep.scriptData?.characters.some((char) => char.libraryId === characterId)).length;

  const getSceneRefCount = (sceneId: string): number =>
    allEpisodes.filter((ep) => ep.scriptData?.scenes.some((scene) => scene.libraryId === sceneId)).length;

  const getPropRefCount = (propId: string): number =>
    allEpisodes.filter((ep) => (ep.scriptData?.props || []).some((prop) => prop.libraryId === propId)).length;

  const switchTab = (nextTab: LibraryAssetType) => {
    setActiveTab(nextTab);
    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.set('tab', nextTab);
    setSearchParams(nextSearch, { replace: true });
    setShowAddModal(false);
  };

  const confirmDeleteAsset = (
    assetTypeLabel: string,
    assetName: string,
    refCount: number,
    onConfirm: () => void
  ) => {
    const msg =
      refCount > 0
        ? `${assetTypeLabel}“${assetName}”已被 ${refCount} 集引用，删除后各集中的引用副本将变为独立${assetTypeLabel}。确定删除？`
        : `确定从${assetTypeLabel}库删除“${assetName}”吗？`;
    showAlert(msg, { type: 'warning', showCancel: true, onConfirm });
  };

  const uploadAssetImage = async <T extends Character | Scene | Prop>(
    asset: T,
    updater: (nextAsset: T) => void,
    file: File
  ) => {
    try {
      const base64 = await convertImageToBase64(file);
      updater({ ...asset, referenceImage: base64, status: 'completed' as const });
    } catch (error) {
      showAlert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`, { type: 'error' });
    }
  };

  const handleDeleteCharacter = (character: Character) =>
    confirmDeleteAsset('角色', character.name, getCharacterRefCount(character.id), () => removeCharacterFromLibrary(character.id));

  const handleDeleteScene = (scene: Scene) =>
    confirmDeleteAsset('场景', scene.location, getSceneRefCount(scene.id), () => removeSceneFromLibrary(scene.id));

  const handleDeleteProp = (prop: Prop) =>
    confirmDeleteAsset('道具', prop.name, getPropRefCount(prop.id), () => removePropFromLibrary(prop.id));

  const handleUploadCharacterImage = (character: Character, file: File) =>
    uploadAssetImage(character, updateCharacterInLibrary, file);

  const handleUploadSceneImage = (scene: Scene, file: File) =>
    uploadAssetImage(scene, updateSceneInLibrary, file);

  const handleUploadPropImage = (prop: Prop, file: File) =>
    uploadAssetImage(prop, updatePropInLibrary, file);

  const handleSaveAsset = (asset: LibraryAsset) => {
    if (activeTab === 'character') {
      updateCharacterInLibrary(asset as Character);
      return;
    }
    if (activeTab === 'scene') {
      updateSceneInLibrary(asset as Scene);
      return;
    }
    updatePropInLibrary(asset as Prop);
  };

  const handleAddAsset = () => {
    if (activeTab === 'character') {
      if (!newCharacterForm.name.trim()) return;
      const nextCharacter: Character = {
        id: createId('char'),
        name: newCharacterForm.name.trim(),
        gender: newCharacterForm.gender.trim() || '未知',
        age: newCharacterForm.age.trim() || '未知',
        personality: newCharacterForm.personality.trim(),
        visualPrompt: '',
        coreFeatures: '',
        variations: [],
        version: 1,
      };
      addCharacterToLibrary(nextCharacter);
      setNewCharacterForm({ name: '', gender: '', age: '', personality: '' });
      setShowAddModal(false);
      return;
    }

    if (activeTab === 'scene') {
      if (!newSceneForm.location.trim()) return;
      const nextScene: Scene = {
        id: createId('scene'),
        location: newSceneForm.location.trim(),
        time: newSceneForm.time.trim() || '未知时间',
        atmosphere: newSceneForm.atmosphere.trim() || '常规',
        visualPrompt: '',
        version: 1,
      };
      addSceneToLibrary(nextScene);
      setNewSceneForm({ location: '', time: '', atmosphere: '' });
      setShowAddModal(false);
      return;
    }

    if (!newPropForm.name.trim()) return;
    const nextProp: Prop = {
      id: createId('prop'),
      name: newPropForm.name.trim(),
      category: newPropForm.category.trim() || '其他',
      description: newPropForm.description.trim(),
      visualPrompt: '',
      version: 1,
    };
    addPropToLibrary(nextProp);
    setNewPropForm({ name: '', category: '', description: '' });
    setShowAddModal(false);
  };

  const getCurrentCount = (): number => {
    if (activeTab === 'character') return filteredCharacters.length;
    if (activeTab === 'scene') return filteredScenes.length;
    return filteredProps.length;
  };

  const renderCharacterList = () => {
    if (filteredCharacters.length === 0) {
      return (
        <div className="border border-dashed border-[var(--border-primary)] p-12 text-center text-[var(--text-muted)]">
          <Users className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">{searchQuery ? '未找到匹配角色' : '角色库为空'}</p>
          <p className="text-[10px] font-mono">点击“添加角色”创建新角色，修改将自动同步到已引用的集。</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredCharacters.map((character) => (
          <AssetLibraryEditorCard
            key={character.id}
            type="character"
            asset={character}
            refCount={getCharacterRefCount(character.id)}
            onSave={handleSaveAsset}
            onDelete={() => handleDeleteCharacter(character)}
            onUploadImage={(file) => handleUploadCharacterImage(character, file)}
            onPreviewImage={setPreviewImage}
          />
        ))}
      </div>
    );
  };

  const renderSceneList = () => {
    if (filteredScenes.length === 0) {
      return (
        <div className="border border-dashed border-[var(--border-primary)] p-12 text-center text-[var(--text-muted)]">
          <MapPin className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">{searchQuery ? '未找到匹配场景' : '场景库为空'}</p>
          <p className="text-[10px] font-mono">点击“添加场景”创建新场景，修改将自动同步到已引用的集。</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredScenes.map((scene) => (
          <AssetLibraryEditorCard
            key={scene.id}
            type="scene"
            asset={scene}
            refCount={getSceneRefCount(scene.id)}
            onSave={handleSaveAsset}
            onDelete={() => handleDeleteScene(scene)}
            onUploadImage={(file) => handleUploadSceneImage(scene, file)}
            onPreviewImage={setPreviewImage}
          />
        ))}
      </div>
    );
  };

  const renderPropList = () => {
    if (filteredProps.length === 0) {
      return (
        <div className="border border-dashed border-[var(--border-primary)] p-12 text-center text-[var(--text-muted)]">
          <Package className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">{searchQuery ? '未找到匹配道具' : '道具库为空'}</p>
          <p className="text-[10px] font-mono">点击“添加道具”创建新道具，修改将自动同步到已引用的集。</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredProps.map((prop) => (
          <AssetLibraryEditorCard
            key={prop.id}
            type="prop"
            asset={prop}
            refCount={getPropRefCount(prop.id)}
            onSave={handleSaveAsset}
            onDelete={() => handleDeleteProp(prop)}
            onUploadImage={(file) => handleUploadPropImage(prop, file)}
            onPreviewImage={setPreviewImage}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-secondary)] p-8 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
          <button
            onClick={() => navigate(`/project/${project.id}`)}
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 group"
          >
            <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
            返回项目概览
          </button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-light text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                <Users className="w-6 h-6 text-[var(--accent-text)]" />
                项目资产库
                <span className="text-[var(--text-muted)] text-sm font-mono uppercase tracking-widest">Project Library</span>
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">
                {project.title} · 角色 {characters.length} · 场景 {scenes.length} · 道具 {props.length}
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'character' ? '添加角色' : activeTab === 'scene' ? '添加场景' : '添加道具'}
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex border border-[var(--border-primary)]">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
                {tab.key === 'character' && ` (${characters.length})`}
                {tab.key === 'scene' && ` (${scenes.length})`}
                {tab.key === 'prop' && ` (${props.length})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'character' ? '搜索角色...' : activeTab === 'scene' ? '搜索场景...' : '搜索道具...'}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)] rounded"
            />
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{getCurrentCount()} items</div>
        </div>

        {activeTab === 'character' && renderCharacterList()}
        {activeTab === 'scene' && renderSceneList()}
        {activeTab === 'prop' && renderPropList()}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/70 p-6" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest mb-4">
              {activeTab === 'character' ? '添加角色到库' : activeTab === 'scene' ? '添加场景到库' : '添加道具到库'}
            </h3>

            {activeTab === 'character' && (
              <div className="space-y-3">
                <input
                  value={newCharacterForm.name}
                  onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="角色名称 *"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)]"
                  autoFocus
                />
                <div className="flex gap-3">
                  <input
                    value={newCharacterForm.gender}
                    onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, gender: e.target.value }))}
                    placeholder="性别"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                  <input
                    value={newCharacterForm.age}
                    onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, age: e.target.value }))}
                    placeholder="年龄"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                </div>
                <textarea
                  value={newCharacterForm.personality}
                  onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, personality: e.target.value }))}
                  placeholder="性格描述"
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
                />
              </div>
            )}

            {activeTab === 'scene' && (
              <div className="space-y-3">
                <input
                  value={newSceneForm.location}
                  onChange={(e) => setNewSceneForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="场景地点 *"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)]"
                  autoFocus
                />
                <div className="flex gap-3">
                  <input
                    value={newSceneForm.time}
                    onChange={(e) => setNewSceneForm((prev) => ({ ...prev, time: e.target.value }))}
                    placeholder="时间"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                  <input
                    value={newSceneForm.atmosphere}
                    onChange={(e) => setNewSceneForm((prev) => ({ ...prev, atmosphere: e.target.value }))}
                    placeholder="氛围"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'prop' && (
              <div className="space-y-3">
                <input
                  value={newPropForm.name}
                  onChange={(e) => setNewPropForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="道具名称 *"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)]"
                  autoFocus
                />
                <input
                  value={newPropForm.category}
                  onChange={(e) => setNewPropForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="道具分类"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <textarea
                  value={newPropForm.description}
                  onChange={(e) => setNewPropForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="道具描述"
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
                />
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddAsset}
                className="flex-1 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-xs font-bold uppercase tracking-widest hover:bg-[var(--btn-primary-hover)]"
              >
                添加
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 border border-[var(--border-primary)] text-[var(--text-tertiary)] text-xs font-bold uppercase tracking-widest hover:text-[var(--text-primary)]"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/90 p-6 cursor-pointer" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </div>
  );
};

export default CharacterLibraryPage;

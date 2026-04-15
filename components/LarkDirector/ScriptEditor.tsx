import React, { useState, useRef, useEffect } from 'react';
import { ProjectState } from '../../types';
import { Edit2, RotateCw, Check, X, Clock, PlusCircle } from 'lucide-react';

interface Props {
  project: ProjectState;
  initialContent?: string;
}

const DEFAULT_SCRIPT = `画面风格和类型：真人写实,电视风格,高清画质,都市女频。
生成一个由以下2个分镜组成的视频。

本片段场景设定在：@泽维尔的办公室_0 。

分镜1 ⏱ 5.0s：氛围压抑而紧张，主要光线昏暗，只有一道门透进明亮的室内光。镜头从@塞西莉亚-基础形象 的背后缓缓推进，她面部朝向门缝。正透过半开的门向泽维尔的办公室里窥视。门缝中，@泽维尔-基础形象 的手指穿过@金发女孩-基础形象 的金发，嘴唇压在她的头顶上。镜头切换到塞西莉亚的面部特写，她瞳孔微缩，随后镜头下移，她的手紧紧攥住文件，指节因用力而发白。画面中所有角色全程不说话。

分镜2 ⏱ 5.0s：在泽维尔的办公室门外，塞西莉亚维持着窥视的姿势，她深吸一口气，胸口有不易察觉的起伏，眼神由震惊转为冰冷。她缓缓抬起手，准备推门。
@塞西莉亚-基础形象 此时没有说话，她在心里想："Eight years. Eight years of us, and this is what I get? You cheating?" (音色：女声，青年音色，音调适中，音色质感冷静清脆，声音清晰适中，发音方式字正腔圆，气息平稳绵长，不带多余的情绪起伏，吐字清晰有力，语速适中)。`;

// 简单的辅助函数，用于提取提到的名字
const parseScriptContent = (text: string, project: ProjectState) => {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // 简单地按 @ 分割，并尝试匹配
    const parts = line.split(/(@\S+)/g);
    
    return (
      <p key={i}>
        {parts.map((part, j) => {
          if (part.startsWith('@')) {
            const name = part.substring(1);
            // 简单的颜色分配逻辑（可根据角色/场景名哈希或预设）
            let colorClass = 'bg-gray-400';
            if (name.includes('泽维尔')) colorClass = 'bg-blue-500';
            else if (name.includes('塞西莉亚')) colorClass = 'bg-orange-400';
            else if (name.includes('金发女孩')) colorClass = 'bg-yellow-400';
            else if (name.includes('办公室')) colorClass = 'bg-blue-400';

            return (
              <span key={j} className="inline-flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded px-1.5 py-0.5 mx-1 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${colorClass}`}></span>
                {name}
              </span>
            );
          }
          return <React.Fragment key={j}>{part}</React.Fragment>;
        })}
        {line === '' && <br />}
      </p>
    );
  });
};

// 获取 textarea 中光标的像素坐标
const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);
  
  for (const prop of Array.from(style)) {
    div.style[prop as any] = style.getPropertyValue(prop);
  }
  
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  
  const textContent = element.value.substring(0, position);
  div.textContent = textContent;
  
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);
  
  document.body.appendChild(div);
  const coordinates = {
    top: span.offsetTop - element.scrollTop,
    left: span.offsetLeft - element.scrollLeft,
    height: parseInt(style.lineHeight) || 20
  };
  document.body.removeChild(div);
  
  return coordinates;
};

const ScriptEditor: React.FC<Props> = ({ project, initialContent }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent || DEFAULT_SCRIPT);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionState, setMentionState] = useState<{
    active: boolean;
    query: string;
    startIndex: number;
    pos: { top: number; left: number };
    selectedIndex: number;
  }>({
    active: false,
    query: '',
    startIndex: 0,
    pos: { top: 0, left: 0 },
    selectedIndex: 0
  });

  const allCharacters = project.scriptData?.characters || [];
  const allScenes = project.scriptData?.scenes || [];

  // 合并所有可选的提及项
  const mentionItems = [
    ...allCharacters.map(c => ({ id: c.id, type: 'character', name: c.name, desc: '基础形象-基础形象', image: c.referenceImage })),
    ...allScenes.map(s => ({ id: s.id, type: 'scene', name: s.location, desc: `${s.location}_0`, image: s.referenceImage })),
    { id: 'time', type: 'action', name: '添加时间', desc: '时间', icon: Clock },
    { id: 'asset', type: 'action', name: '从资产库添加', desc: '从总览添加', icon: PlusCircle }
  ].filter(item => item.name.toLowerCase().includes(mentionState.query.toLowerCase()));

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    if (mentionState.active) {
      const cursor = e.target.selectionStart;
      if (cursor < mentionState.startIndex) {
        setMentionState(prev => ({ ...prev, active: false }));
      } else {
        const query = val.substring(mentionState.startIndex, cursor);
        // 如果中间有空格，则取消 @ 状态
        if (query.includes(' ') || query.includes('\n')) {
          setMentionState(prev => ({ ...prev, active: false }));
        } else {
          setMentionState(prev => ({ ...prev, query, selectedIndex: 0 }));
        }
      }
    } else {
      // 检测是否刚刚输入了 @
      const cursor = e.target.selectionStart;
      if (val[cursor - 1] === '@') {
        const coords = getCaretCoordinates(e.target, cursor);
        setMentionState({
          active: true,
          query: '',
          startIndex: cursor,
          pos: { top: coords.top + coords.height, left: coords.left },
          selectedIndex: 0
        });
      }
    }
  };

  const insertMention = (item: any) => {
    if (!textareaRef.current) return;
    const text = content;
    const cursor = textareaRef.current.selectionStart;
    
    let insertText = '';
    if (item.type === 'character') insertText = `${item.name}-基础形象 `;
    else if (item.type === 'scene') insertText = `${item.name}_0 `;
    else insertText = `${item.name} `;

    const newText = text.substring(0, mentionState.startIndex) + insertText + text.substring(cursor);
    setContent(newText);
    setMentionState(prev => ({ ...prev, active: false }));
    
    // 恢复焦点并移动光标
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionState.startIndex + insertText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionState.active) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionState(prev => ({
        ...prev,
        selectedIndex: (prev.selectedIndex + 1) % mentionItems.length
      }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionState(prev => ({
        ...prev,
        selectedIndex: (prev.selectedIndex - 1 + mentionItems.length) % mentionItems.length
      }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mentionItems[mentionState.selectedIndex]) {
        insertMention(mentionItems[mentionState.selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setMentionState(prev => ({ ...prev, active: false }));
    }
  };

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setMentionState(prev => ({ ...prev, active: false }));
    };
    if (mentionState.active) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [mentionState.active]);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl p-6 min-h-full flex flex-col relative shadow-sm transition-all duration-200">
      {isEditing ? (
        <div className="flex-1 relative flex flex-col">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            className="flex-1 w-full bg-transparent text-[13px] leading-relaxed text-[var(--text-primary)] resize-none outline-none custom-scrollbar"
            placeholder="在此输入剧本内容，使用 @ 召唤资产菜单..."
            autoFocus
          />
          
          {/* Mention Popup */}
          {mentionState.active && (
            <div 
              className="absolute z-50 w-64 bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              style={{ top: mentionState.pos.top + 8, left: Math.min(mentionState.pos.left, 400) }}
              onClick={e => e.stopPropagation()}
            >
              <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5">
                {mentionItems.length > 0 ? (
                  mentionItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        idx === mentionState.selectedIndex ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                      }`}
                      onClick={() => insertMention(item)}
                      onMouseEnter={() => setMentionState(prev => ({ ...prev, selectedIndex: idx }))}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-surface)] shrink-0 flex items-center justify-center border border-[var(--border-subtle)]">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : item.icon ? (
                          <item.icon className="w-4 h-4 text-[var(--text-tertiary)]" />
                        ) : null}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] truncate">{item.desc}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-[var(--text-tertiary)]">未找到匹配项</div>
                )}
              </div>
            </div>
          )}

          <div className="absolute bottom-0 right-0 flex gap-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-full text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              取消
            </button>
            <button 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] rounded-full text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              完成编辑
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-[13px] leading-relaxed text-[var(--text-secondary)] space-y-4">
            {parseScriptContent(content, project)}
          </div>

          <div className="absolute bottom-6 right-6 flex gap-3">
            <button 
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-full text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Edit2 className="w-3.5 h-3.5" />
              编辑脚本
            </button>
            <button className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] hover:bg-[var(--text-secondary)] rounded-full text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">
              <RotateCw className="w-3.5 h-3.5" />
              再次生成
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ScriptEditor;
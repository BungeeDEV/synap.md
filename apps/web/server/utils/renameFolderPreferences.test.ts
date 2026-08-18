import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES } from '@synap/store/preferences_types'
import { rewritePreferencePathsForRename } from './renameFolderPreferences'

describe('rewritePreferencePathsForRename', () => {
  it('rewrites favorites, expandedFolders and folderColors keys nested under the renamed folder', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      favorites: ['Projects/a.md', 'Projects/Sub/b.md', 'Elsewhere/c.md'],
      expandedFolders: ['Projects', 'Projects/Sub', 'Elsewhere'],
      folderColors: { 'Projects/Sub': 'blue', Elsewhere: 'red' }
    }

    const result = rewritePreferencePathsForRename(prefs, 'Projects', 'Work')

    expect(result).not.toBeNull()
    expect(result!.favorites).toEqual(['Work/a.md', 'Work/Sub/b.md', 'Elsewhere/c.md'])
    expect(result!.expandedFolders).toEqual(['Work', 'Work/Sub', 'Elsewhere'])
    expect(result!.folderColors).toEqual({ 'Work/Sub': 'blue', Elsewhere: 'red' })
  })

  it('rewrites the renamed folder itself when it was favorited/expanded/colored directly, not just its descendants', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      favorites: ['Projects'],
      expandedFolders: ['Projects'],
      folderColors: { Projects: 'green' }
    }

    const result = rewritePreferencePathsForRename(prefs, 'Projects', 'Work')

    expect(result!.favorites).toEqual(['Work'])
    expect(result!.expandedFolders).toEqual(['Work'])
    expect(result!.folderColors).toEqual({ Work: 'green' })
  })

  it('does not touch a same-prefix sibling folder', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      favorites: ['Projects-Archive/b.md'],
      expandedFolders: ['Projects-Archive'],
      folderColors: { 'Projects-Archive': 'purple' }
    }

    const result = rewritePreferencePathsForRename(prefs, 'Projects', 'Work')

    expect(result).toBeNull()
  })

  it('returns null when nothing in prefs references the renamed folder', () => {
    const result = rewritePreferencePathsForRename(DEFAULT_PREFERENCES, 'Projects', 'Work')
    expect(result).toBeNull()
  })
})

# Image source watermarks

Public images now use the reviewed latent distributed signature, FFT spectrum mark, keyed DCT identifier, fragile LSB identifier and source provenance metadata. Large and small variants are embedded independently at their published dimensions and exported losslessly. A very small friend avatar uses the small-image profile without DCT; the SVG favicon retains its vector artwork with provenance metadata.

Signatures identify this website as the publishing source; existing artwork, photography and friend attribution remain on their pages. No visible corner label is added. Image dimensions and alpha are preserved. The embedding tools and keys are outside this public repository.

The public main history is intentionally reset to a single current snapshot at the owner's request. The old terminal version remains available in the owner's local recovery repository for preview comparison. Only the latest successful website deployment run is retained.

Lossless output preserves the latent low-bit layers at the cost of larger files. The frequency identifier is separately verified after export. These marks help trace published versions and do not guarantee resistance to every transformation or removal.

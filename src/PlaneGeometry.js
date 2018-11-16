export default function PlaneGeometry(
    width,
    height,
    widthSegments,
    heightSegments
) {
    this.parameters = {
        width: width,
        height: height,
        widthSegments: widthSegments,
        heightSegments: heightSegments
    };

    width = width || 1;
    height = height || 1;

    const width_half = width / 2;
    const height_half = height / 2;

    const gridX = Math.floor(widthSegments) || 1;
    const gridY = Math.floor(heightSegments) || 1;

    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const segment_width = width / gridX;
    const segment_height = height / gridY;

    let ix, iy;

    this.indices = [];
    this.vertices = [];
    this.normals = [];
    this.uvs = [];

    for (iy = 0; iy < gridY1; iy++) {
        const y = iy * segment_height - height_half;

        for (ix = 0; ix < gridX1; ix++) {
            const x = ix * segment_width - width_half;

            this.vertices.push(x, -y, 0);

            this.normals.push(0, 0, 1);

            this.uvs.push(ix / gridX);
            this.uvs.push(1 - iy / gridY);
        }
    }

    for (iy = 0; iy < gridY; iy++) {
        for (ix = 0; ix < gridX; ix++) {
            const a = ix + gridX1 * iy;
            const b = ix + gridX1 * (iy + 1);
            const c = ix + 1 + gridX1 * (iy + 1);
            const d = ix + 1 + gridX1 * iy;

            // faces

            this.indices.push(a, b, d);
            this.indices.push(b, c, d);
        }
    }
}

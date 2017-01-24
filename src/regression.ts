interface Range
{
    min: number;
    max: number;
}

interface RegressionSpecifier
{
    type: string,
    order?: number
}

interface RegressionAnalysis
{
    r2: number;
    aic: number;
    bic: number;
    constantError?: Array<number>
}

interface RegressionModel
{
    predict(x): number;
    toString(): string;
    constants: Array<number>;
    analysis?: RegressionAnalysis;
}

namespace r
{
    export class MatrixUtility
    {
        static error(sse: Array<Array<number>>, m: Array<Array<number>>): Array<number>
        {
            let result = this.mmul(sse, this.inverse(this.mmulLTranspose(m))), errors = [];

            for (let i = 0; i < result.length; i++)
                errors.push(result[i][0]);

            return errors;
        }

        static det(m: Array<Array<number>>): number
        {
            //Need to LU decompose and multiply the diagonal to find the determinant
            return 0;
        }

        static transpose(matrix: Array<Array<number>>): Array<Array<number>>
        {
            let m = matrix[0].length, n = matrix.length, t = this.zeros(m,n);

            for (let x = 0; x < m; x++)
            {
                for (let y = 0; y < n; y++)
                    t[x][y] = matrix[y][x];
            }

            return t;
        }

        static inverse(matrix: Array<Array<number>>): Array<Array<number>>
        {
            let m = matrix.length, n = matrix[0].length, id = 1.0/this.det(matrix), t = this.transpose(matrix);

            for (let x = 0; x < m; x++)
            {
                for (let y = 0; y < n; y++)
                    t[x][y] *= id;
            }

            return t;
        }

        static scale(s: number, m: Array<Array<number>>): Array<Array<number>>
        {
            let x = m.length, y = m[0].length, r = this.zeros(x, y);

            for (let i = 0; i < x; i++)
                for (let j = 0; j < y; j++)
                {
                    r[i][j] = m[i][j]*s;
                }

            return r;
        }

        static zeros(m: number, n: number): Array<Array<number>>
        {
            let matrix = Array.apply(null, Array(m));
            for (let x = 0; x < m; x++)
            {
                matrix[x] = Array.apply(null, Array(n)).map(Number.prototype.valueOf, 0);
            }

            return matrix;
        }

        static mmul(lhs: Array<Array<number>>, rhs: Array<Array<number>>): Array<Array<number>>
        {
            let n = lhs[0].length, m = rhs.length, r = this.zeros(m, n), min = Math.min(lhs.length, rhs[0].length);

            for (let x = 0; x < m; x++)
                for (let y = 0; y < n; y++)
                {
                    for (let n = 0; n < min; n++)
                    {
                        r[x][y] += lhs[n][y] * rhs[x][n];
                    }
                }

            return r;
        }

        static mmulLTranspose(m: Array<Array<number>>): Array<Array<number>>
        {
            let len = m.length, r = this.zeros(m.length, m.length), o = m[0].length;

            for (let x = 0; x < len; x++)
                for (let y = 0; y < len; y++)
                {
                    for (let n = 0; n < o; n++)
                    {
                        r[x][y] += m[y][n] * m[x][n];
                    }    
                }

            return r;
        }
    }

    export class RegressionMethods
    {
        static precision: number = 2;
        static defaultMethods: Array<RegressionSpecifier> = [{ type: 'linear' }, { type: 'exponential' }, { type: 'logarithmic' }];

        static analysis(data: Array<Array<number>>, regression: Array<Array<number>>, p: number): RegressionAnalysis
        {
            let n = data.length;

            let mean = 0;
            for (let i = 0; i < n; i++)
            {
                mean += data[i][1];
            }
            mean /= data.length;

            let ssy = 0;
            for (let i = 0; i < n; i++)
            {
                let diff = data[i][1] - mean;
                ssy += diff * diff;
            }

            let sse = 0;
            for (let i = 0; i < n; i++)
            {
                let residual = data[i][1] - regression[i][1];
                sse += residual * residual;
            }

            //Common calculation between the AIC & BIC 
            let common = n + n * Math.log(2 * Math.PI) + n * Math.log(sse / n);

            let matrix = MatrixUtility.zeros(2, data.length);
            for (var i = 0; i < data.length; i++)
            {
                matrix[0][i] = 1;
                matrix[1][i] = data[i][0];
            }
            var error = MatrixUtility.error([[1],[sse]], matrix);
            console.log(error);
       

            return {
                r2: 1 - (sse / ssy),
                aic: common + 2 * (p + 1),
                bic: common + Math.log(n) * (p + 1)
            };
        }

        static auto(data: Array<Array<number>>, methods: Array<RegressionSpecifier>, options: any): RegressionModel
        {
            let bestModel: RegressionModel;
            for (let i = 0; i < methods.length; i++)
            {
                let model = this[methods[i].type](data, methods[i].order, options);

                if (!bestModel || bestModel.analysis.bic > model.analysis.bic)
                    bestModel = model;
            }
            return bestModel;
        }

        static linear(data: Array<Array<number>>, order: number, options: any): RegressionModel
        {
            let sum = [0, 0, 0, 0, 0], constants = [0, 0], len = data.length;

            for (let n = 0; n < len; n++)
            {
                if (data[n][1] !== null)
                {
                    sum[0] += data[n][0];
                    sum[1] += data[n][1];
                    sum[2] += data[n][0] * data[n][0];
                    sum[3] += data[n][0] * data[n][1];
                    sum[4] += data[n][1] * data[n][1];
                }
            }

            constants[1] = (len * sum[3] - sum[0] * sum[1]) / (len * sum[2] - sum[0] * sum[0]);
            constants[0] = (sum[1] / len) - (constants[1] * sum[0]) / len;

            let points = data.map(function (xy) { return [xy[0], constants[1] * xy[0] + constants[0]]; });

            return {
                constants: constants,
                analysis: this.analysis(data, points, 2),
                predict: function (x) { return x * this.constants[1] + this.constants[0]; },
                toString: function () { return 'y = ' + this.constants[1] + 'x ' + (this.constants[0] < 0.0 ? '- ' : '+ ') + Math.abs(this.constants[0]); }
            };
        }

        static logarithmic(data: Array<Array<number>>, order: number, options: any): any
        {
            let sum = [0, 0, 0, 0], constants = [0, 0], len = data.length;

            for (let n = 0; n < len; n++) {
                if (data[n][1] !== null) {
                    sum[0] += Math.log(data[n][0]);
                    sum[1] += data[n][1] * Math.log(data[n][0]);
                    sum[2] += data[n][1];
                    sum[3] += Math.pow(Math.log(data[n][0]), 2);
                }
            }

            constants[0] = (len * sum[1] - sum[2] * sum[0]) / (len * sum[3] - sum[0] * sum[0]);
            constants[1] = (sum[2] - constants[0] * sum[0]) / len;

            let points = data.map(function (xy) {  return [xy[0], constants[0] + constants[1] * Math.log(xy[0])]; });

            return {
                constants: constants,
                analysis: this.analysis(data, points, 2),
                predict: function (x) { return this.constants[0] + this.constants[1]*Math.log(x); },
                toString: function () { return 'y = ' + this.constants[0] + (this.constants[1] < 0 ? ' - ' : ' + ') + Math.abs(this.constants[1])+ 'log(x)'; }
            };
        }

        static exponential(data: Array<Array<number>>, order: number, options: any): RegressionModel
        {
            let sum = [0, 0, 0, 0, 0, 0], constants = [0, 0], denominator;

            for (var n = 0; n < data.length; n++)
            {
                if (data[n][1] !== 0)
                {
                    sum[0] += data[n][0];
                    sum[1] += data[n][1];
                    sum[2] += data[n][0] * data[n][0] * data[n][1];
                    sum[3] += data[n][1] * Math.log(data[n][1]);
                    sum[4] += data[n][0] * data[n][1] * Math.log(data[n][1]);
                    sum[5] += data[n][0] * data[n][1];
                }
            }
   
            denominator = (sum[1] * sum[2] - sum[5] * sum[5]);
            constants[0] = Math.exp((sum[2] * sum[3] - sum[5] * sum[4]) / denominator);
            constants[1] = (sum[1] * sum[4] - sum[5] * sum[3]) / denominator;

            let points = data.map(function (xy) { return [xy[0], constants[0] * Math.exp(constants[1]*xy[0])]; });

            return {
                constants: constants,
                analysis: this.analysis(data,points,2),
                predict: function (x) { return this.constants[0] * Math.exp(this.constants[1] * x); },
                toString: function () { return 'y = ' + this.constants[0] + 'e^(' + this.constants[1] + 'x)'; }
            };
        }
    }
}

function regression(type: string, data: Array<Array<number>>, order: number | Array<RegressionSpecifier>,options: any)
{
    if (type === 'auto' && !order)
        order = r.RegressionMethods.defaultMethods;

    //Configure default options here

   return r.RegressionMethods[type.toLowerCase()](data,order,options);
}
import React from 'react';
import PropTypes from 'prop-types';
import { size, filter, forEach, extend } from 'lodash';
import { react2angular } from 'react2angular';
import { SortableContainer, SortableElement, DragHandle } from '@/components/sortable';
import { $location } from '@/services/ng';
import { Parameter } from '@/services/query';
import ParameterApplyButton from '@/components/ParameterApplyButton';
import ParameterValueInput from '@/components/ParameterValueInput';
import EditParameterSettingsDialog from './EditParameterSettingsDialog';
import { toHuman } from '@/filters';

import './Parameters.less';

function updateUrl(parameters) {
  const params = extend({}, $location.search());
  parameters.forEach((param) => {
    extend(params, param.toUrlParams());
  });
  Object.keys(params).forEach(key => params[key] == null && delete params[key]);
  $location.search(params);
}

export class Parameters extends React.Component {
  static propTypes = {
    parameters: PropTypes.arrayOf(PropTypes.instanceOf(Parameter)),
    editable: PropTypes.bool,
    disableUrlUpdate: PropTypes.bool,
    onValuesChange: PropTypes.func,
    onPendingValuesChange: PropTypes.func,
    onParametersEdit: PropTypes.func,
  };

  static defaultProps = {
    parameters: [],
    editable: false,
    disableUrlUpdate: false,
    onValuesChange: () => {},
    onPendingValuesChange: () => {},
    onParametersEdit: () => {},
  };

  constructor(props) {
    super(props);
    const { parameters } = props;
    this.state = { parameters };
    if (!props.disableUrlUpdate) {
      updateUrl(parameters);
    }
  }

  componentDidUpdate = (prevProps) => {
    const { parameters, disableUrlUpdate } = this.props;
    if (prevProps.parameters !== parameters) {
      this.setState({ parameters });
      if (!disableUrlUpdate) {
        updateUrl(parameters);
      }
    }
  };

  handleKeyDown = (e) => {
    // Cmd/Ctrl/Alt + Enter
    if (e.keyCode === 13 && (e.ctrlKey || e.metaKey || e.altKey)) {
      e.stopPropagation();
      this.applyChanges();
    }
  };

  setPendingValue = (param, value, isDirty) => {
    const { onPendingValuesChange } = this.props;
    this.setState(({ parameters }) => {
      if (isDirty) {
        param.setPendingValue(value);
      } else {
        param.clearPendingValue();
      }
      onPendingValuesChange();
      return { parameters };
    });
  };

  moveParameter = ({ oldIndex, newIndex }) => {
    const { onParametersEdit } = this.props;
    if (oldIndex !== newIndex) {
      this.setState(({ parameters }) => {
        parameters.splice(newIndex, 0, parameters.splice(oldIndex, 1)[0]);
        onParametersEdit();
        return { parameters };
      });
    }
  };

  applyChanges = () => {
    const { onValuesChange, disableUrlUpdate } = this.props;
    this.setState(({ parameters }) => {
      const parametersWithPendingValues = parameters.filter(p => p.hasPendingValue);
      forEach(parameters, p => p.applyPendingValue());
      if (!disableUrlUpdate) {
        updateUrl(parameters);
      }
      onValuesChange(parametersWithPendingValues);
      return { parameters };
    });
  };

  showParameterSettings = (parameter, index) => {
    const { onParametersEdit } = this.props;
    EditParameterSettingsDialog
      .showModal({ parameter })
      .result.then((updated) => {
        this.setState(({ parameters }) => {
          const updatedParameter = extend(parameter, updated);
          parameters[index] = new Parameter(updatedParameter, updatedParameter.parentQueryId);
          onParametersEdit();
          return { parameters };
        });
      });
  };

  renderParameter(param, index) {
    const { editable } = this.props;
    return (
      <div
        key={param.name}
        className="di-block"
        data-test={`ParameterName-${param.name}`}
      >
        <div className="parameter-heading">
          <label>{param.title || toHuman(param.name)}</label>
          {editable && (
            <button
              className="btn btn-default btn-xs m-l-5"
              onClick={() => this.showParameterSettings(param, index)}
              data-test={`ParameterSettings-${param.name}`}
              type="button"
            >
              <i className="fa fa-cog" />
            </button>
          )}
        </div>
        <ParameterValueInput
          type={param.type}
          value={param.normalizedValue}
          parameter={param}
          enumOptions={param.enumOptions}
          queryId={param.queryId}
          allowMultipleValues={!!param.multiValuesOptions}
          onSelect={(value, isDirty) => this.setPendingValue(param, value, isDirty)}
        />
      </div>
    );
  }

  render() {
    const { parameters } = this.state;
    const { editable } = this.props;
    const dirtyParamCount = size(filter(parameters, 'hasPendingValue'));
    return (
      <SortableContainer
        disabled={!editable}
        axis="xy"
        useDragHandle
        lockToContainerEdges
        helperClass="parameter-dragged"
        updateBeforeSortStart={this.onBeforeSortStart}
        onSortEnd={this.moveParameter}
        containerProps={{
          className: 'parameter-container',
          onKeyDown: dirtyParamCount ? this.handleKeyDown : null,
        }}
      >
        {parameters.map((param, index) => (
          <SortableElement key={param.name} index={index}>
            <div className="parameter-block" data-editable={editable || null}>
              {editable && <DragHandle data-test={`DragHandle-${param.name}`} />}
              {this.renderParameter(param, index)}
            </div>
          </SortableElement>
        ))}
        <ParameterApplyButton onClick={this.applyChanges} paramCount={dirtyParamCount} />
      </SortableContainer>
    );
  }
}

export default function init(ngModule) {
  ngModule.component('parameters', react2angular(Parameters));
}

init.init = true;
